from app.routers import messages
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.auth import router as auth_router

app = FastAPI(title="Campus Appointment Tracking System")
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(messages.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "campus-messaging"}

@app.get("/api/hello")
def hello():
    return {"message": "Hello from Python!"}
