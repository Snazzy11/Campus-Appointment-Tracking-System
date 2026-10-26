from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.health.health import router as health_router
from api.routers.locations.locations import router as locations_router

app = FastAPI(
    title="Campus Appointment and Tracking System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # both of the front end ports need to be allowed
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# Health endpoint
app.include_router(health_router)

# api for messages (excluded until it becomes used)
# app.include_router(messaging_router)

# campus locations imported from OpenStreetMap
app.include_router(locations_router)
