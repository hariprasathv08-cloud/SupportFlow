import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_helpdeskx.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_register_user():
    response = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "testadmin@helpdeskx.com",
            "full_name": "Test Admin Profile",
            "role": "Admin",
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testadmin@helpdeskx.com"
    assert data["full_name"] == "Test Admin Profile"
    assert data["role"] == "Admin"

def test_login_user():
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@helpdeskx.com",
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "Admin"
    assert data["token_type"] == "bearer"

def test_get_me_unauthorized():
    response = client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401

def test_get_me_authorized():
    # Login to get token
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@helpdeskx.com",
            "password": "TestPassword123!"
        }
    )
    token = login_res.json()["access_token"]
    
    response = client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testadmin@helpdeskx.com"

def test_get_system_specs():
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@helpdeskx.com",
            "password": "TestPassword123!"
        }
    )
    token = login_res.json()["access_token"]

    response = client.get(
        f"{settings.API_V1_STR}/system/specs",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "hostname" in data
    assert "os_name" in data

def test_user_preferences():
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@helpdeskx.com",
            "password": "TestPassword123!"
        }
    )
    token = login_res.json()["access_token"]
    
    # Fetch default preferences (should auto-create)
    get_res = client.get(
        f"{settings.API_V1_STR}/user/preferences",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_res.status_code == 200
    prefs = get_res.json()
    assert prefs["theme"] == "system"
    assert prefs["density"] == "normal"
    
    # Update preferences
    put_res = client.put(
        f"{settings.API_V1_STR}/user/preferences",
        json={"theme": "dark", "density": "compact"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["theme"] == "dark"
    assert updated["density"] == "compact"

