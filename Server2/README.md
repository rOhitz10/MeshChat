# MeshChat - Server 2 (FastAPI)

Production-grade, asynchronous backend server for MeshChat built with **FastAPI**, **Motor (Async MongoDB)**, **WebSockets**, and **JWT Authentication**.

## Architecture Overview

```
Server2/
├── app/
│   ├── api/
│   │   └── v1/               # Versioned API routes (auth, users, chats, ws, health)
│   ├── core/                 # App configuration, database connection, security, dependencies
│   ├── schemas/              # Pydantic validation & data models
│   ├── services/             # Core business logic & WebSocket connection management
│   └── main.py               # FastAPI entrypoint, lifespan, CORS & middleware
├── .env                      # Local environment configuration
├── .env.example              # Sample environment template
├── requirements.txt          # Python dependencies
└── run.py                    # Direct launcher script
```

## Features

- **Asynchronous MongoDB (Motor)**: Fully async database queries with automatic connection pooling and index creation.
- **Real-Time WebSockets**: Pub/Sub style WebSocket Connection Manager with presence tracking, typing indicators, and message broadcasts.
- **JWT & Password Security**: BCrypt password hashing and JWT access tokens compatible with Server 1 (NestJS).
- **Dual API Surface**:
  - Full RESTful v1 API (`/api/v1/...`)
  - Server 1 compatibility routes (`/auth/login`, `/auth/register`, `/user/me`, etc.)
- **Interactive Documentation**: Auto-generated Swagger UI at `http://localhost:8000/docs` and Redoc at `http://localhost:8000/redoc`.

## Quick Start

### 1. Activate Virtual Environment
```bash
# Windows
.\.venv\Scripts\activate
```

### 2. Run Server
```bash
python run.py
# or using uvicorn directly:
uvicorn app.main:app --reload --port 8000
```

Server will start on: **`http://localhost:8000`**  
API Documentation: **`http://localhost:8000/docs`**  
WebSocket endpoint: **`ws://localhost:8000/ws?token=<jwt_token>`**
