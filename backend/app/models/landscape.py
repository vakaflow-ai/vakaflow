"""
Landscape positioning model
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class LandscapePosition(Base):
    """Technology landscape positioning for entities"""
    __tablename__ = "landscape_positions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Linked entity
    entity_type = Column(String(50), nullable=False, index=True)  # product, service, agent
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Landscape positioning
    category = Column(String(100), nullable=False)  # Security, Compliance, Analytics, etc.
    subcategory = Column(String(100), nullable=True)
    quadrant = Column(String(50), nullable=True)  # Leader, Challenger, Visionary, Niche
    position_x = Column(Float, nullable=True)  # X-axis value (0-100)
    position_y = Column(Float, nullable=True)  # Y-axis value (0-100)
    
    # Positioning criteria
    capability_score = Column(Integer, nullable=True)  # 0-100
    business_value_score = Column(Integer, nullable=True)  # 0-100
    maturity_score = Column(Integer, nullable=True)  # 0-100
    risk_score = Column(Integer, nullable=True)  # 0-100
    
    # Metadata
    framework = Column(String(100), nullable=True)  # Gartner, Forrester, custom
    last_updated = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
