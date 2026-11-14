from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cats.api.routers.health.health import router as health_router
from cats.api.routers.locations.locations import router as locations_router
from cats.api.routers.schedule.schedule import router as schedule_router

app = FastAPI(
    title="Campus Appointment and Tracking System",
    version="0.2.1",
)

api_prefix = "/api"

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
app.include_router(locations_router)  # todo add api prefix

# calendar events
app.include_router(schedule_router, prefix=api_prefix)
