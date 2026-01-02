"""
Messages and comments API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.message import Message, MessageType
from app.models.agent import Agent
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from fastapi import Request

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    """Message creation schema"""
    resource_type: str = Field(..., pattern="^(agent|review|policy|assessment_question_response)$")
    resource_id: str  # Can be UUID or string identifier for assessment_question_response
    content: str = Field(..., min_length=1)
    message_type: str = Field(default="comment", pattern="^(comment|question|reply)$")
    parent_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None


class MessageResponse(BaseModel):
    """Message response schema"""
    id: str
    message_type: str
    content: str
    resource_type: str
    resource_id: str
    sender_id: str
    sender_name: str
    recipient_id: Optional[str]
    parent_id: Optional[str]
    is_read: bool
    created_at: str
    replies: List['MessageResponse'] = []
    
    class Config:
        from_attributes = True


MessageResponse.model_rebuild()


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    message_data: MessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a message/comment"""
    # Verify resource exists and convert resource_id to UUID if needed
    resource_id_uuid = None
    
    if message_data.resource_type == "agent":
        try:
            resource_id_uuid = UUID(message_data.resource_id) if isinstance(message_data.resource_id, str) else message_data.resource_id
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid resource_id format for agent: {message_data.resource_id}")
        
        resource = db.query(Agent).filter(Agent.id == resource_id_uuid).first()
        if not resource:
            raise HTTPException(status_code=404, detail="Agent not found")
    elif message_data.resource_type == "assessment_question_response":
        # For assessment question responses, resource_id can be a string identifier
        # Store it as a string in the database (we'll need to handle this in the model)
        # For now, generate a UUID to store, but keep the original string in metadata
        import uuid
        # Use a deterministic UUID based on the string, or generate a new one
        # Since Message.resource_id is UUID, we'll need to handle this differently
        # For now, create a UUID from the string hash
        try:
            # Try to parse as UUID first
            resource_id_uuid = UUID(message_data.resource_id)
        except (ValueError, TypeError):
            # If not a UUID, create a deterministic UUID from the string
            # Using UUID5 with a namespace
            namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # DNS namespace
            resource_id_uuid = uuid.uuid5(namespace, f"assessment_question_response:{message_data.resource_id}")
    else:
        # For other resource types, try to parse as UUID
        try:
            resource_id_uuid = UUID(message_data.resource_id) if isinstance(message_data.resource_id, str) else message_data.resource_id
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid resource_id format: {message_data.resource_id}")
    
    # Create message
    message = Message(
        tenant_id=current_user.tenant_id,
        message_type=message_data.message_type,
        content=message_data.content,
        resource_type=message_data.resource_type,
        resource_id=resource_id_uuid,
        parent_id=message_data.parent_id,
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="message",
        resource_id=str(message.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"resource_type": message_data.resource_type, "resource_id": str(message_data.resource_id)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Get sender name
    sender = db.query(User).filter(User.id == current_user.id).first()
    
    return MessageResponse(
        id=str(message.id),
        message_type=message.message_type,
        content=message.content,
        resource_type=message.resource_type,
        resource_id=str(message.resource_id),
        sender_id=str(message.sender_id),
        sender_name=sender.name if sender else "Unknown",
        recipient_id=str(message.recipient_id) if message.recipient_id else None,
        parent_id=str(message.parent_id) if message.parent_id else None,
        is_read=message.is_read,
        created_at=message.created_at.isoformat(),
        replies=[]
    )


@router.get("", response_model=List[MessageResponse])
async def get_messages(
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,  # Changed to str to accept both UUID and string identifiers
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages/comments"""
    query = db.query(Message).filter(
        Message.is_archived == False
    )
    
    # Filter by tenant
    if current_user.tenant_id:
        query = query.filter(Message.tenant_id == current_user.tenant_id)
    
    # Filter by resource
    if resource_type:
        query = query.filter(Message.resource_type == resource_type)
    if resource_id:
        # Handle both UUID and string identifiers for assessment_question_response
        if resource_type == "assessment_question_response":
            # Convert string identifier to deterministic UUID
            import uuid
            try:
                # Try to parse as UUID first
                resource_id_uuid = UUID(resource_id)
            except (ValueError, TypeError):
                # If not a UUID, create deterministic UUID from the string
                namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # DNS namespace
                resource_id_uuid = uuid.uuid5(namespace, f"assessment_question_response:{resource_id}")
            query = query.filter(Message.resource_id == resource_id_uuid)
        else:
            # For other resource types, parse as UUID
            try:
                resource_id_uuid = UUID(resource_id) if isinstance(resource_id, str) else resource_id
                query = query.filter(Message.resource_id == resource_id_uuid)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"Invalid resource_id format: {resource_id}")
    
    # For agent resources, allow all users in the tenant to see comments
    # (vendors, reviewers, approvers all need to see comments on agents)
    if resource_type == "agent" and resource_id:
        # Verify agent exists and user has access
        agent = db.query(Agent).filter(Agent.id == resource_id).first()
        if agent:
            # Check tenant access
            from app.models.vendor import Vendor
            vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
            if vendor and vendor.tenant_id:
                if current_user.tenant_id != vendor.tenant_id and current_user.role.value != "platform_admin":
                    raise HTTPException(status_code=403, detail="Access denied")
            # Allow all users in tenant to see agent comments
            # Don't filter by sender/recipient for agent comments
        else:
            raise HTTPException(status_code=404, detail="Agent not found")
    else:
        # For other resources, filter by user (messages to/from current user)
        query = query.filter(
            (Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id) | (Message.recipient_id.is_(None))
        )
    
    # Unread only
    if unread_only:
        query = query.filter(Message.is_read == False)
    
    messages = query.order_by(Message.created_at.desc()).limit(100).all()
    
    # Build reply tree
    message_map = {str(m.id): MessageResponse(
        id=str(m.id),
        message_type=m.message_type,
        content=m.content,
        resource_type=m.resource_type,
        resource_id=str(m.resource_id),
        sender_id=str(m.sender_id),
        sender_name="",  # Will be filled below
        recipient_id=str(m.recipient_id) if m.recipient_id else None,
        parent_id=str(m.parent_id) if m.parent_id else None,
        is_read=m.is_read,
        created_at=m.created_at.isoformat(),
        replies=[]
    ) for m in messages}
    
    # Get sender names
    user_ids = set(str(m.sender_id) for m in messages)
    users = db.query(User).filter(User.id.in_([UUID(uid) for uid in user_ids])).all()
    user_map = {str(u.id): u.name for u in users}
    
    # Build reply tree
    root_messages = []
    for msg in messages:
        msg_response = message_map[str(msg.id)]
        msg_response.sender_name = user_map.get(str(msg.sender_id), "Unknown")
        
        if msg.parent_id:
            parent = message_map.get(str(msg.parent_id))
            if parent:
                parent.replies.append(msg_response)
        else:
            root_messages.append(msg_response)
    
    return root_messages


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get unread message count"""
    query = db.query(Message).filter(
        Message.recipient_id == current_user.id,
        Message.is_read == False,
        Message.is_archived == False
    )
    
    if current_user.tenant_id:
        query = query.filter(Message.tenant_id == current_user.tenant_id)
    
    count = query.count()
    return {"unread_count": count}


@router.patch("/{message_id}/read")
async def mark_as_read(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark message as read"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check permissions
    if message.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    message.is_read = True
    db.commit()
    
    return {"status": "read"}

