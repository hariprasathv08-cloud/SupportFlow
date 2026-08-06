import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.sync_database_url
connect_args = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    # Attempt to initialize PostgreSQL engine with optimized connection pooling
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_size=20,
        max_overflow=30,
        pool_timeout=15,
        pool_recycle=1800,
        pool_pre_ping=True
    )
    # Simple test connection to confirm DB exists and is reachable
    with engine.connect() as conn:
        pass
except Exception as e:
    # Fallback to local SQLite if PostgreSQL connection fails
    print(f"PostgreSQL connection failed ({e}). Falling back to local SQLite database...")
    db_path = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "supportflow.db")
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
