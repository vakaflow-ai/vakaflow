"""
File upload and management API
Handles assessment evidence files with scheduled cleanup
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
import shutil

from app.core.database import get_db
from app.models.file import FileMetadata
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/files", tags=["files"])

# Configuration
UPLOAD_DIR = os.getenv("FILE_UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))  # 50MB default
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif", ".txt", ".csv"}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

def validate_file_extension(filename: str) -> str:
    """Validate file extension and return normalized extension"""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext

def validate_file_size(file_size: int) -> None:
    """Validate file size"""
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024):.1f}MB"
        )

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    context: str = Query(..., description="Context identifier (e.g., assessment_assignment_id)"),
    context_type: str = Query(..., description="Context type (e.g., assessment, questionnaire)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file and store metadata in database
    Files are stored with scheduled cleanup based on retention policy
    """
    try:
        # Validate file
        validate_file_extension(file.filename)
        file_content = await file.read()
        validate_file_size(len(file_content))
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1]
        stored_filename = f"{file_id}{ext}"
        file_path = os.path.join(UPLOAD_DIR, stored_filename)
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create database record
        file_record = FileMetadata(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            file_id=file_id,
            original_name=file.filename,
            stored_name=stored_filename,
            file_path=file_path,
            file_size=len(file_content),
            mime_type=file.content_type or "application/octet-stream",
            context_type=context_type,
            context_id=context,
            uploaded_by=current_user.id,
            retention_days=90,  # Default 90-day retention
            expires_at=datetime.utcnow() + timedelta(days=90)
        )
        
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "size": len(file_content),
            "path": stored_filename,  # This is what gets stored in assessment responses
            "uploaded_at": file_record.created_at.isoformat()
        }
        
    except Exception as e:
        # Clean up file if database operation fails
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}")
async def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a file by its ID
    """
    file_record = db.query(FileMetadata).filter(
        and_(
            FileMetadata.file_id == file_id,
            FileMetadata.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Update last accessed time
    file_record.last_accessed = datetime.utcnow()
    db.commit()
    
    return {
        "file_id": file_record.file_id,
        "filename": file_record.original_name,
        "path": file_record.file_path,
        "size": file_record.file_size,
        "mime_type": file_record.mime_type,
        "uploaded_at": file_record.created_at.isoformat()
    }

@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file (soft delete - marks as deleted but keeps for cleanup)
    """
    file_record = db.query(FileMetadata).filter(
        and_(
            FileMetadata.file_id == file_id,
            FileMetadata.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Mark as deleted (soft delete)
    file_record.deleted_at = datetime.utcnow()
    file_record.deleted_by = current_user.id
    
    # Actually delete file from disk
    if os.path.exists(file_record.file_path):
        os.remove(file_record.file_path)
    
    db.commit()
    
    return {"success": True, "message": "File deleted successfully"}

@router.get("/")
async def list_files(
    context_type: Optional[str] = None,
    context_id: Optional[str] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List files with optional filtering by context
    """
    query = db.query(FileMetadata).filter(
        FileMetadata.tenant_id == current_user.tenant_id
    )
    
    if context_type:
        query = query.filter(FileMetadata.context_type == context_type)
    
    if context_id:
        query = query.filter(FileMetadata.context_id == context_id)
    
    if not include_deleted:
        query = query.filter(FileMetadata.deleted_at.is_(None))
    
    files = query.order_by(FileMetadata.created_at.desc()).all()
    
    return [
        {
            "file_id": f.file_id,
            "filename": f.original_name,
            "size": f.file_size,
            "context_type": f.context_type,
            "context_id": f.context_id,
            "uploaded_at": f.created_at.isoformat(),
            "expires_at": f.expires_at.isoformat() if f.expires_at else None,
            "deleted": f.deleted_at is not None
        }
        for f in files
    ]

# Scheduled cleanup job (would be called by cron/scheduler)
@router.post("/cleanup")
async def cleanup_expired_files(
    dry_run: bool = False,
    db: Session = Depends(get_db)
):
    """
    Cleanup expired files
    This should be called periodically by a scheduled job
    """
    expired_files = db.query(FileMetadata).filter(
        and_(
            FileMetadata.expires_at < datetime.utcnow(),
            FileMetadata.deleted_at.is_(None)
        )
    ).all()
    
    deleted_count = 0
    errors = []
    
    for file_record in expired_files:
        try:
            if not dry_run:
                # Delete from disk
                if os.path.exists(file_record.file_path):
                    os.remove(file_record.file_path)
                
                # Mark as deleted in database
                file_record.deleted_at = datetime.utcnow()
                file_record.deleted_reason = "AUTO_EXPIRED"
            
            deleted_count += 1
            
        except Exception as e:
            errors.append(f"Failed to delete {file_record.file_id}: {str(e)}")
    
    if not dry_run:
        db.commit()
    
    return {
        "success": True,
        "dry_run": dry_run,
        "expired_files_found": len(expired_files),
        "files_processed": deleted_count,
        "errors": errors
    }