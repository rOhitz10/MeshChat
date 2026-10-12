from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.user import UserProfileResponse, UserUpdateRequest


class UserService:
    @staticmethod
    def _format_user(doc: Dict[str, Any]) -> UserProfileResponse:
        """Format MongoDB user document into UserProfileResponse."""
        return UserProfileResponse(
            id=str(doc["_id"]),
            name=doc.get("name", ""),
            email=doc.get("email", ""),
            avatar=doc.get("avatar", ""),
            bio=doc.get("bio", ""),
            isVerified=doc.get("isVerified", False),
            isOnline=doc.get("isOnline", False),
            lastSeen=doc.get("lastSeen"),
            created_at=doc.get("createdAt"),
        )

    @classmethod
    async def get_by_id(cls, db: AsyncIOMotorDatabase, user_id: str) -> UserProfileResponse:
        """Fetch user by id."""
        query: Dict[str, Any] = {}
        if ObjectId.is_valid(user_id):
            query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]}
        else:
            query = {"_id": user_id}

        user = await db["users"].find_one(query, {"password": 0})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return cls._format_user(user)

    @classmethod
    async def update_profile(
        cls, db: AsyncIOMotorDatabase, user_id: str, dto: UserUpdateRequest
    ) -> UserProfileResponse:
        """Update user profile fields."""
        update_fields: Dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}

        if dto.name is not None:
            update_fields["name"] = dto.name.strip()
        if dto.avatar is not None:
            update_fields["avatar"] = dto.avatar
        if dto.bio is not None:
            update_fields["bio"] = dto.bio

        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}

        result = await db["users"].find_one_and_update(
            query,
            {"$set": update_fields},
            return_document=True,
            projection={"password": 0},
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return cls._format_user(result)

    @classmethod
    async def search_users(
        cls,
        db: AsyncIOMotorDatabase,
        query_str: str,
        current_user_id: str,
        limit: int = 20,
    ) -> List[UserProfileResponse]:
        """Search users by name or email for discovering chat contacts."""
        filter_query: Dict[str, Any] = {}
        if query_str.strip():
            regex_pattern = {"$regex": query_str.strip(), "$options": "i"}
            filter_query["$or"] = [
                {"name": regex_pattern},
                {"email": regex_pattern},
            ]

        # Exclude self
        if ObjectId.is_valid(current_user_id):
            filter_query["_id"] = {"$ne": ObjectId(current_user_id)}
        else:
            filter_query["_id"] = {"$ne": current_user_id}

        cursor = db["users"].find(filter_query, {"password": 0}).limit(limit)
        users = await cursor.to_list(length=limit)
        return [cls._format_user(u) for u in users]
