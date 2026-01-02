"""
Pytest configuration and fixtures
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.core.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.core.security import get_password_hash
import uuid

# Test database URL (use in-memory SQLite for tests)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a test database session"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Create a test user"""
    from app.models.tenant import Tenant
    
    # Create tenant first
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Test Tenant",
        domain="test.com"
    )
    db.add(tenant)
    db.flush()
    
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test User",
        role=UserRole.VENDOR_USER,
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    """Create an admin user"""
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        name="Admin User",
        role=UserRole.TENANT_ADMIN,
        hashed_password=get_password_hash("adminpassword123"),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

