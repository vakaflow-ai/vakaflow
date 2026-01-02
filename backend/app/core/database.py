"""
Database configuration and session management
"""
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create database engine with connection pooling and optimizations
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,  # Number of connections to maintain
    max_overflow=20,  # Maximum overflow connections
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False,  # Set to True for SQL logging in development
    connect_args={
        "connect_timeout": 5,  # Reduced from 10 to fail faster
        "application_name": "vaka_backend",
        "options": "-c statement_timeout=5000"  # 5 second query timeout
    }
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # Don't expire objects after commit (better performance)
)

# Base class for models
Base = declarative_base()


# Performance monitoring
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set PostgreSQL optimizations"""
    # For PostgreSQL, we can set session-level optimizations
    if 'postgresql' in settings.DATABASE_URL:
        try:
            with dbapi_conn.cursor() as cursor:
                # Set shorter timeouts to prevent hanging
                cursor.execute("SET statement_timeout = '5s'")  # 5 second query timeout
                cursor.execute("SET lock_timeout = '3s'")  # 3 second lock timeout
        except Exception as e:
            logger.warning(f"Failed to set PostgreSQL timeouts: {e}")


def get_db():
    """Dependency for getting database session
    
    Properly handles transaction rollback on errors to prevent
    'current transaction is aborted' errors.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        # Re-raise to let FastAPI handle the error
        raise
    finally:
        db.close()

