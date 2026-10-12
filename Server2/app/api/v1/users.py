from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.user import UserProfileResponse, UserUpdateRequest
from app.services.user_service import UserService

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse, summary="Get own profile")
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return profile for the currently logged-in user."""
    return UserService._format_user(current_user)


@router.patch("/me", response_model=UserProfileResponse, summary="Update own profile")
async def update_my_profile(
    dto: UserUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update name, avatar or bio for current user."""
    return await UserService.update_profile(db, current_user["id"], dto)


@router.get("/search", response_model=List[UserProfileResponse], summary="Search contacts")
async def search_users(
    q: str = Query(default="", description="Search query string"),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Search registered users to initiate chats."""
    return await UserService.search_users(db, q, current_user["id"], limit)


@router.get("/{user_id}", response_model=UserProfileResponse, summary="Get user by ID")
async def get_user_by_id(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: Dict[str, Any] = Depends(get_current_user),
):
    """Fetch public user profile by user ID."""
    return await UserService.get_by_id(db, user_id)
