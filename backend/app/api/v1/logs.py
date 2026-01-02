"""
Application logs API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
import logging
import os
from pathlib import Path
import glob

router = APIRouter(prefix="/logs", tags=["logs"])

# Configure logging to file
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "application.log"
ERROR_LOG_FILE = LOG_DIR / "errors.log"

# Set up file handler if not already configured
file_handler = None
for handler in logging.root.handlers:
    if isinstance(handler, logging.FileHandler) and handler.baseFilename == str(LOG_FILE.absolute()):
        file_handler = handler
        break

if not file_handler:
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    )
    logging.root.addHandler(file_handler)


class LogEntry(BaseModel):
    """Log entry response schema"""
    timestamp: str
    level: str
    logger: str
    message: str
    module: Optional[str] = None
    function: Optional[str] = None
    line: Optional[int] = None


class LogListResponse(BaseModel):
    """Log list response schema"""
    logs: List[LogEntry]
    total: int
    limit: int
    offset: int


@router.get("", response_model=LogListResponse)
async def get_application_logs(
    level: Optional[str] = Query(None, description="Filter by log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get application logs (Admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Read log file
    if not LOG_FILE.exists():
        return LogListResponse(logs=[], total=0, limit=limit, offset=offset)
    
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Parse log entries
        log_entries = []
        for line in lines:
            try:
                # Parse log format: timestamp - logger - level - message
                parts = line.strip().split(' - ', 3)
                if len(parts) >= 4:
                    timestamp_str = parts[0]
                    logger_name = parts[1]
                    log_level = parts[2]
                    message = parts[3]
                    
                    # Apply filters
                    if level and log_level.upper() != level.upper():
                        continue
                    
                    if start_date:
                        try:
                            log_time = datetime.fromisoformat(timestamp_str.replace(' ', 'T'))
                            start = datetime.fromisoformat(start_date)
                            if log_time < start:
                                continue
                        except:
                            pass
                    
                    if end_date:
                        try:
                            log_time = datetime.fromisoformat(timestamp_str.replace(' ', 'T'))
                            end = datetime.fromisoformat(end_date)
                            if log_time > end:
                                continue
                        except:
                            pass
                    
                    log_entries.append({
                        "timestamp": timestamp_str,
                        "level": log_level,
                        "logger": logger_name,
                        "message": message
                    })
            except Exception as e:
                # Skip malformed log lines
                continue
        
        # Reverse to show newest first
        log_entries.reverse()
        
        # Apply pagination
        total = len(log_entries)
        paginated_logs = log_entries[offset:offset + limit]
        
        return LogListResponse(
            logs=[
                LogEntry(**entry) for entry in paginated_logs
            ],
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read logs: {str(e)}"
        )


class LogFileInfo(BaseModel):
    """Log file information schema"""
    filename: str
    filepath: str  # Full path to the log file
    size_bytes: int
    size_mb: float
    modified: str
    age_days: float


class LogStatsResponse(BaseModel):
    """Log statistics response schema"""
    files: List[LogFileInfo]
    total_files: int
    total_size_bytes: int
    total_size_mb: float


class ClearLogsRequest(BaseModel):
    """Clear logs request schema"""
    older_than_days: Optional[int] = None  # If set, only delete logs older than this many days
    include_rotated: bool = True  # Include rotated backup files
    log_type: Optional[str] = None  # 'application', 'errors', or None for both


@router.get("/stats", response_model=LogStatsResponse)
async def get_log_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get log file statistics (Admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        log_files = []
        total_size = 0
        
        # Find all log files (including rotated backups)
        patterns = [
            str(LOG_DIR / "application.log*"),
            str(LOG_DIR / "errors.log*"),
        ]
        
        for pattern in patterns:
            for file_path in glob.glob(pattern):
                path = Path(file_path)
                if path.is_file():
                    stat = path.stat()
                    size_bytes = stat.st_size
                    size_mb = size_bytes / (1024 * 1024)
                    modified = datetime.fromtimestamp(stat.st_mtime)
                    age_days = (datetime.now() - modified).total_seconds() / 86400
                    
                    log_files.append({
                        "filename": path.name,
                        "filepath": str(path.absolute()),
                        "size_bytes": size_bytes,
                        "size_mb": round(size_mb, 2),
                        "modified": modified.isoformat(),
                        "age_days": round(age_days, 2)
                    })
                    total_size += size_bytes
        
        # Sort by filename
        log_files.sort(key=lambda x: x["filename"])
        
        return LogStatsResponse(
            files=[LogFileInfo(**f) for f in log_files],
            total_files=len(log_files),
            total_size_bytes=total_size,
            total_size_mb=round(total_size / (1024 * 1024), 2)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get log stats: {str(e)}"
        )


@router.delete("")
async def clear_logs(
    request: Optional[ClearLogsRequest] = None,
    older_than_days: Optional[int] = Query(None, description="Delete logs older than X days"),
    include_rotated: bool = Query(True, description="Include rotated backup files"),
    log_type: Optional[str] = Query(None, description="Log type: 'application', 'errors', or None for both"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear application logs (Platform Admin only)
    
    Options:
    - older_than_days: Only delete logs older than specified days
    - include_rotated: Include rotated backup files (application.log.1, errors.log.1, etc.)
    - log_type: 'application' for application.log only, 'errors' for errors.log only, None for both
    """
    # Check permissions
    if current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can clear logs"
        )
    
    # Use query params if request body not provided (for backward compatibility)
    if request is None:
        request = ClearLogsRequest(
            older_than_days=older_than_days,
            include_rotated=include_rotated,
            log_type=log_type
        )
    
    try:
        deleted_files = []
        deleted_count = 0
        total_size_freed = 0
        cutoff_date = None
        
        if request.older_than_days:
            cutoff_date = datetime.now() - timedelta(days=request.older_than_days)
        
        # Determine which log files to process
        patterns = []
        if not request.log_type or request.log_type == "application":
            if request.include_rotated:
                patterns.append(str(LOG_DIR / "application.log*"))
            else:
                patterns.append(str(LOG_DIR / "application.log"))
        
        if not request.log_type or request.log_type == "errors":
            if request.include_rotated:
                patterns.append(str(LOG_DIR / "errors.log*"))
            else:
                patterns.append(str(LOG_DIR / "errors.log"))
        
        # Find and delete matching log files
        for pattern in patterns:
            for file_path in glob.glob(pattern):
                path = Path(file_path)
                if path.is_file():
                    # Check age filter if specified
                    if cutoff_date:
                        stat = path.stat()
                        file_modified = datetime.fromtimestamp(stat.st_mtime)
                        if file_modified >= cutoff_date:
                            continue  # Skip files newer than cutoff
                    
                    # Delete the file
                    try:
                        size = path.stat().st_size
                        path.unlink()
                        deleted_files.append(path.name)
                        deleted_count += 1
                        total_size_freed += size
                    except Exception as e:
                        logging.error(f"Failed to delete log file {path}: {e}")
        
        # Log the action
        logging.info(
            f"Logs cleared by {current_user.email}: "
            f"{deleted_count} files deleted, {round(total_size_freed / (1024 * 1024), 2)} MB freed. "
            f"Options: older_than_days={request.older_than_days}, "
            f"include_rotated={request.include_rotated}, log_type={request.log_type}"
        )
        
        return {
            "message": f"Logs cleared successfully",
            "deleted_files": deleted_files,
            "deleted_count": deleted_count,
            "size_freed_mb": round(total_size_freed / (1024 * 1024), 2),
            "options": {
                "older_than_days": request.older_than_days,
                "include_rotated": request.include_rotated,
                "log_type": request.log_type
            }
        }
    except Exception as e:
        logging.error(f"Failed to clear logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear logs: {str(e)}"
        )

