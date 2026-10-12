from fastapi import APIRouter
from app.core.database import DatabaseManager
from app.schemas.common import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
async def health_check():
    """Health check endpoint to verify server readiness and database connectivity."""
    db_connected = await DatabaseManager.is_connected()
    return HealthCheckResponse(
        status="ok" if db_connected else "degraded",
        server="MeshChat FastAPI Server (Server 2)",
        version="1.0.0",
        database_connected=db_connected,
    )
