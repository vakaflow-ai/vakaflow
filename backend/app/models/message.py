"""
Message and comment models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class MessageType(str, enum.Enum):
    """Message type"""
    COMMENT = "comment"
    QUESTION = "question"
    REPLY = "reply"
    NOTIFICATION = "notification"


class Message(Base):
    """Message/Comment model"""
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Message content
    message_type = Column(String(50), nullable=False, default=MessageType.COMMENT.value)
    content = Column(Text, nullable=False)
    
    # Relationships
    resource_type = Column(String(100), nullable=False, index=True)  # agent, review, etc.
    resource_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)  # For replies
    
    # Sender and recipient
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # sender = relationship("User", foreign_keys=[sender_id])
    # recipient = relationship("User", foreign_keys=[recipient_id])
    # parent = relationship("Message", remote_side=[id])
    # replies = relationship("Message", back_populates="parent")

