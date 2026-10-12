import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1 import auth, health, users, ws
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import DatabaseManager

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("meshchat.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan lifecycle events."""
    logger.info("Initializing MeshChat FastAPI Server...")
    await DatabaseManager.connect()
    yield
    logger.info("Shutting down MeshChat FastAPI Server...")
    await DatabaseManager.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade FastAPI backend for MeshChat with real-time WebSockets, async MongoDB, and JWT authentication.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Process time middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


# Top-level Health check & WS endpoints
app.include_router(health.router, tags=["Health"])
app.include_router(ws.router, tags=["WebSocket"])

# Include versioned API router (/api/v1)
app.include_router(api_router, prefix=settings.API_V1_STR)

# Compatibility Routers matching Server 1 (NestJS) paths (/auth, /user)
app.include_router(auth.router, prefix="/auth", tags=["Compatibility (Server 1)"])
app.include_router(users.router, prefix="/user", tags=["Compatibility (Server 1)"])


@app.get("/", tags=["Root"])
async def root():
    """Root metadata endpoint."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "framework": "FastAPI",
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_STR,
    }
