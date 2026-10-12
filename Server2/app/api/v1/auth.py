from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.schemas.user import UserProfileResponse
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter()


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
)
async def register(
    req: RegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Register a new user account with name, email, and password."""
    return await AuthService.register(db, req)


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user",
)
async def login(
    req: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Authenticate existing user with email and password."""
    return await AuthService.login(db, req)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get authenticated user profile",
)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve profile details for the currently authenticated user."""
    return UserService._format_user(current_user)
