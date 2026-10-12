import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.core.config import settings

logger = logging.getLogger("meshchat.database")


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect(cls) -> None:
        """Initialize MongoDB client and verify connectivity."""
        try:
            logger.info(f"Connecting to MongoDB at: {settings.MONGODB_URI}")
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=3000,
            )
            cls.db = cls.client[settings.DATABASE_NAME]

            # Attempt a quick ping to verify connection
            await cls.client.admin.command("ping")
            logger.info("Successfully connected to MongoDB.")

            # Create essential indexes
            await cls.create_indexes()
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.warning(
                f"MongoDB connection warning: Could not ping server ({e}). "
                "The server will continue running and retry on incoming requests."
            )
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {e}")

    @classmethod
    async def create_indexes(cls) -> None:
        """Create database indexes for optimized querying."""
        if cls.db is None:
            return

        try:
            # Users collection indexes
            users_col = cls.db["users"]
            await users_col.create_index(
                [("email", ASCENDING)],
                unique=True,
                name="idx_users_email_unique"
            )

            # Conversations collection indexes
            conv_col = cls.db["conversations"]
            await conv_col.create_index(
                [("participants", ASCENDING)],
                name="idx_conv_participants"
            )
            await conv_col.create_index(
                [("updated_at", ASCENDING)],
                name="idx_conv_updated_at"
            )

            # Messages collection indexes
            msg_col = cls.db["messages"]
            await msg_col.create_index(
                [("conversation_id", ASCENDING), ("created_at", ASCENDING)],
                name="idx_messages_conversation_date"
            )
            logger.info("Database indexes ensured successfully.")
        except Exception as e:
            logger.warning(f"Index creation note: {e}")

    @classmethod
    async def disconnect(cls) -> None:
        """Close MongoDB connection gracefully."""
        if cls.client:
            logger.info("Closing MongoDB connection.")
            cls.client.close()
            cls.client = None
            cls.db = None

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Retrieve the database instance."""
        if cls.db is None:
            if cls.client is None:
                cls.client = AsyncIOMotorClient(
                    settings.MONGODB_URI,
                    serverSelectionTimeoutMS=3000,
                )
            cls.db = cls.client[settings.DATABASE_NAME]
        return cls.db

    @classmethod
    async def is_connected(cls) -> bool:
        """Check if database is reachable."""
        try:
            if cls.client is None:
                return False
            await cls.client.admin.command("ping")
            return True
        except Exception:
            return False


def get_db() -> AsyncIOMotorDatabase:
    """Dependency helper to return database instance."""
    return DatabaseManager.get_db()
