import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_supportflow.db"
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
            "email": "testadmin@supportflow.com",
            "full_name": "Test Admin Profile",
            "role": "SUPER_ADMIN",
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testadmin@supportflow.com"
    assert data["full_name"] == "Test Admin Profile"
    assert data["role"] == "SUPER_ADMIN"

def test_login_user():
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@supportflow.com",
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "SUPER_ADMIN"
    assert data["token_type"] == "bearer"

def test_get_me_unauthorized():
    response = client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401

def test_get_me_authorized():
    # Login to get token
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@supportflow.com",
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
    assert data["email"] == "testadmin@supportflow.com"

def test_get_system_specs():
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@supportflow.com",
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
            "email": "testadmin@supportflow.com",
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

def test_login_with_username():
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin",
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "SUPER_ADMIN"

def test_login_brute_force_lockout():
    reg_res = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "lockout_test@supportflow.com",
            "full_name": "Lockout Test User",
            "password": "CorrectPassword123!"
        }
    )
    assert reg_res.status_code == 200
    
    # Try 5 failed logins
    for i in range(5):
        fail_res = client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={
                "email": "lockout_test@supportflow.com",
                "password": "WrongPassword!"
            }
        )
        assert fail_res.status_code == 400
        
    # Lockout check
    lock_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "lockout_test@supportflow.com",
            "password": "CorrectPassword123!"
        }
    )
    assert lock_res.status_code == 400
    assert "locked out" in lock_res.json()["detail"].lower()

def test_forgot_and_reset_password():
    reg_res = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "reset_test@supportflow.com",
            "full_name": "Reset Test User",
            "password": "OldPassword123!"
        }
    )
    assert reg_res.status_code == 200
    
    forgot_res = client.post(
        f"{settings.API_V1_STR}/auth/forgot-password",
        json={"email": "reset_test@supportflow.com"}
    )
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json()["reset_token"]
    
    reset_res = client.post(
        f"{settings.API_V1_STR}/auth/reset-password",
        json={
            "token": reset_token,
            "new_password": "NewPassword123!"
        }
    )
    assert reset_res.status_code == 200
    
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "reset_test@supportflow.com",
            "password": "NewPassword123!"
        }
    )
    assert login_res.status_code == 200

def test_rbac_permissions_gate():
    login_res = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "testadmin@supportflow.com",
            "password": "TestPassword123!"
        }
    )
    admin_token = login_res.json()["access_token"]
    
    emp_res = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "emp_test@supportflow.com",
            "full_name": "Employee User",
            "password": "Password123!",
            "role": "EMPLOYEE"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert emp_res.status_code == 200
    assert emp_res.json()["role"] == "EMPLOYEE"
    
    viewer_res = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "viewer_test@supportflow.com",
            "full_name": "Viewer User",
            "password": "Password123!",
            "role": "VIEWER"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert viewer_res.status_code == 200
    assert viewer_res.json()["role"] == "VIEWER"

    emp_login = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "emp_test@supportflow.com",
            "password": "Password123!"
        }
    )
    emp_token = emp_login.json()["access_token"]
    
    users_res = client.post(
        f"{settings.API_V1_STR}/users",
        json={
            "email": "another@supportflow.com",
            "full_name": "Another User",
            "password": "Password123!",
            "role": "EMPLOYEE"
        },
        headers={"Authorization": f"Bearer {emp_token}"}
    )
    assert users_res.status_code == 403
    
    viewer_login = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "viewer_test@supportflow.com",
            "password": "Password123!"
        }
    )
    viewer_token = viewer_login.json()["access_token"]
    
    asset_res = client.post(
        f"{settings.API_V1_STR}/assets",
        json={
            "hostname": "test-host",
            "serial_number": "SN123456",
            "operating_system": "Windows 11"
        },
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert asset_res.status_code == 403

