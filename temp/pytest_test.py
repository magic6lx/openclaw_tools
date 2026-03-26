import pytest
import requests
import json

BASE_URL = "http://localhost:3000/api"

class TestInvitationCodes:
    """测试邀请码管理功能"""

    def test_generate_invitation_code(self):
        """测试生成邀请码"""
        response = requests.post(f"{BASE_URL}/invitation-codes/generate", json={
            "max_devices": 3
        })
        assert response.status_code == 201
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "code" in data["data"]
        assert len(data["data"]["code"]) == 11
        assert data["data"]["code"].isalpha()

    def test_validate_invitation_code(self, test_code):
        """测试验证邀请码"""
        response = requests.get(f"{BASE_URL}/invitation-codes/{test_code}/validate")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True

    def test_bind_device(self, test_code):
        """测试绑定设备"""
        response = requests.post(f"{BASE_URL}/invitation-codes/{test_code}/bind", json={
            "device_id": "test-device-001",
            "device_info": {
                "device_name": "Test Device",
                "os_type": "Windows",
                "os_version": "10"
            }
        })
        assert response.status_code == 201
        data = response.json()
        assert data["success"] == True
        assert "data" in data

    def test_disable_invitation_code(self, test_code):
        """测试禁用邀请码"""
        response = requests.put(f"{BASE_URL}/invitation-codes/{test_code}/disable")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True

    def test_enable_invitation_code(self, test_code):
        """测试启用邀请码"""
        response = requests.put(f"{BASE_URL}/invitation-codes/{test_code}/enable")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestAuth:
    """测试用户认证功能"""

    def test_login_with_invitation_code(self, test_code):
        """测试使用邀请码登录"""
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "code": test_code,
            "device_id": "test-device-002",
            "device_info": {
                "device_name": "Test Device 2",
                "os_type": "Windows",
                "os_version": "10"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "token" in data["data"]
        assert "user" in data["data"]

    def test_get_user_info(self, auth_token):
        """测试获取用户信息"""
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data

    def test_refresh_token(self, auth_token):
        """测试刷新Token"""
        response = requests.post(f"{BASE_URL}/auth/refresh", json={
            "token": auth_token
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "token" in data["data"]

    def test_logout(self, auth_token):
        """测试登出"""
        response = requests.post(
            f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


@pytest.fixture
def test_code():
    """创建测试邀请码"""
    response = requests.post(f"{BASE_URL}/invitation-codes/generate", json={
        "max_devices": 3
    })
    return response.json()["data"]["code"]


@pytest.fixture
def auth_token(test_code):
    """获取认证Token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "code": test_code,
        "device_id": "test-device-auth",
        "device_info": {
            "device_name": "Auth Test Device",
            "os_type": "Windows",
            "os_version": "10"
        }
    })
    return response.json()["data"]["token"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])