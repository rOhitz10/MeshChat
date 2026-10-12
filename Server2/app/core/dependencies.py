from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import DatabaseManager, get_db
from app.core.security import decode_access_token

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Authenticate user via HTTP Bearer token and return user document.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Search user by ObjectId or string id
    query: Dict[str, Any] = {}
    if ObjectId.is_valid(user_id):
        query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]}
    else:
        query = {"_id": user_id}

    user = await db["users"].find_one(query)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authenticated user no longer exists",
        )

    user["id"] = str(user["_id"])
    return user


async def get_current_user_from_token(
    token: str,
    db: AsyncIOMotorDatabase,
) -> Optional[Dict[str, Any]]:
    """
    Helper to authenticate user directly from a token string (used in WebSockets).
    """
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    query: Dict[str, Any] = {}
    if ObjectId.is_valid(user_id):
        query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]}
    else:
        query = {"_id": user_id}

    user = await db["users"].find_one(query)
    if user:
        user["id"] = str(user["_id"])
    return user
