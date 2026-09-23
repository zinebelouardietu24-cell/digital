from typing import Optional, Dict
from app.core.security import verify_password, get_password_hash
from app.domains.auth.schemas import UserResponse

# Pre-defined industrial roles and accounts
DEMO_USERS: Dict[str, Dict] = {
    "operator": {
        "id": "USR-001",
        "username": "operator",
        "password_hash": get_password_hash("operator123"),
        "full_name": "Hamza Alami",
        "email": "h.alami@jesa.ma",
        "role": "Plant Operator",
        "organization": "JESA / OCP Group",
        "institution": "ENSEM Casablanca"
    },
    "engineer": {
        "id": "USR-002",
        "username": "engineer",
        "password_hash": get_password_hash("engineer123"),
        "full_name": "Dr. Sarah Benali",
        "email": "s.benali@jesa.ma",
        "role": "Process Engineer",
        "organization": "JESA / OCP Group",
        "institution": "ENSEM Casablanca"
    },
    "admin": {
        "id": "USR-003",
        "username": "admin",
        "password_hash": get_password_hash("admin123"),
        "full_name": "Prof. Zakaria K.",
        "email": "admin.pfa@ensab.ac.ma",
        "role": "Plant Director",
        "organization": "JESA / OCP Group",
        "institution": "ENSEM Casablanca"
    }
}

class AuthService:
    """Authentication and User Management Domain Service."""

    def authenticate_user(self, username: str, password: str) -> Optional[UserResponse]:
        """Authenticate user against stored hashed credentials."""
        user_dict = DEMO_USERS.get(username.lower())
        if not user_dict:
            return None
        if not verify_password(password, user_dict["password_hash"]):
            return None
        return UserResponse(
            id=user_dict["id"],
            username=user_dict["username"],
            full_name=user_dict["full_name"],
            email=user_dict["email"],
            role=user_dict["role"],
            organization=user_dict["organization"],
            institution=user_dict["institution"]
        )

    def get_user_by_username(self, username: str) -> Optional[UserResponse]:
        """Retrieve user response model by username."""
        user_dict = DEMO_USERS.get(username.lower())
        if not user_dict:
            return None
        return UserResponse(
            id=user_dict["id"],
            username=user_dict["username"],
            full_name=user_dict["full_name"],
            email=user_dict["email"],
            role=user_dict["role"],
            organization=user_dict["organization"],
            institution=user_dict["institution"]
        )
