from datetime import datetime, timezone
from typing import Any, Dict
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest


class AuthService:
    @staticmethod
    async def register(db: AsyncIOMotorDatabase, req: RegisterRequest) -> AuthResponse:
        """Register a new user in MongoDB and issue access token."""
        normalized_email = req.email.lower().strip()

        # Check existing user
        existing = await db["users"].find_one({"email": normalized_email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )

        hashed_pw = hash_password(req.password)
        now = datetime.now(timezone.utc)

        user_doc: Dict[str, Any] = {
            "name": req.name.strip(),
            "email": normalized_email,
            "password": hashed_pw,
            "avatar": req.avatar or "",
            "bio": req.bio or "",
            "isVerified": False,
            "isOnline": False,
            "lastSeen": now,
            "createdAt": now,
            "updatedAt": now,
        }

        result = await db["users"].insert_one(user_doc)
        user_id = str(result.inserted_id)

        token = create_access_token(
            subject=user_id,
            username=user_doc["name"],
            email=user_doc["email"],
        )

        return AuthResponse(
            access_token=token,
            token_type="bearer",
            userId=user_id,
            username=user_doc["name"],
            userEmail=user_doc["email"],
        )

    @staticmethod
    async def login(db: AsyncIOMotorDatabase, req: LoginRequest) -> AuthResponse:
        """Authenticate user with email and password."""
        normalized_email = req.email.lower().strip()

        user = await db["users"].find_one({"email": normalized_email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not verify_password(req.password, user.get("password", "")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user_id = str(user["_id"])
        token = create_access_token(
            subject=user_id,
            username=user.get("name", ""),
            email=user.get("email", ""),
        )

        return AuthResponse(
            access_token=token,
            token_type="bearer",
            userId=user_id,
            username=user.get("name", ""),
            userEmail=user.get("email", ""),
        )
