"""
Knowledge base API endpoints for RAG
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.rag_service import rag_service

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class DocumentIngest(BaseModel):
    """Document ingestion schema"""
    document_type: str
    content: str
    metadata: Optional[dict] = None


class SearchQuery(BaseModel):
    """Search query schema"""
    query: str
    limit: int = 5
    score_threshold: float = 0.7


class SearchResult(BaseModel):
    """Search result schema"""
    id: str
    score: float
    metadata: dict
    content: str


class SearchResponse(BaseModel):
    """Search response schema"""
    results: List[SearchResult]
    total: int


@router.post("/agents/{agent_id}/documents", status_code=status.HTTP_201_CREATED)
async def ingest_document(
    agent_id: UUID,
    document: DocumentIngest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ingest a document into the knowledge base for an agent"""
    # Check feature gate: RAG search
    if current_user.tenant_id:
        from app.core.feature_gating import FeatureGate
        if not FeatureGate.is_feature_enabled(db, str(current_user.tenant_id), "rag_search", current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="RAG knowledge search is not available in your plan. Please upgrade."
            )
    
    # Verify agent exists and user has access
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions
    if current_user.role.value == "vendor_user":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor or agent.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    try:
        doc_id = await rag_service.ingest_document(
            agent_id=str(agent_id),
            document_type=document.document_type,
            content=document.content,
            metadata=document.metadata
        )
        
        return {
            "document_id": doc_id,
            "agent_id": str(agent_id),
            "status": "ingested"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest document: {str(e)}"
        )


@router.post("/agents/{agent_id}/search", response_model=SearchResponse)
async def search_agent_knowledge(
    agent_id: UUID,
    search_query: SearchQuery,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search the knowledge base for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    try:
        results = await rag_service.search(
            query=search_query.query,
            agent_id=str(agent_id),
            limit=search_query.limit,
            score_threshold=search_query.score_threshold
        )
        
        return SearchResponse(
            results=[
                SearchResult(
                    id=r["id"],
                    score=r["score"],
                    metadata=r["metadata"],
                    content=r["content"]
                )
                for r in results
            ],
            total=len(results)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/agents/{agent_id}/documents")
async def get_agent_documents(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    try:
        documents = await rag_service.get_agent_knowledge(str(agent_id))
        return {
            "agent_id": str(agent_id),
            "documents": documents,
            "total": len(documents)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get documents: {str(e)}"
        )


@router.delete("/agents/{agent_id}/documents")
async def delete_agent_documents(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all documents for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions (only vendor or admin)
    if current_user.role.value == "vendor_user":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor or agent.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    try:
        success = await rag_service.delete_agent_knowledge(str(agent_id))
        if success:
            return {
                "agent_id": str(agent_id),
                "status": "deleted"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete documents"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete documents: {str(e)}"
        )

