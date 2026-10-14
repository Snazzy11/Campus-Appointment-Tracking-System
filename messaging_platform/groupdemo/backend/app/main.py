
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.auth import router as auth_router
from .routers.messages import router as messages_router
from .routers.conversations import router as conversations_router
from .routers.private_stream import router as private_stream_router

from .routers.users import router as users_router
from .routers.groups import router as groups_router

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register application routers
app.include_router(auth_router)
app.include_router(messages_router)
app.include_router(conversations_router)
app.include_router(private_stream_router)
app.include_router(users_router)
app.include_router(groups_router)



@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "campus-messaging",
    }


@app.get("/api/hello")
def hello():
    return {"message": "Hello from Python!"}
