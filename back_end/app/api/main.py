import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.auth.auth import enabled, require_user
from api.routers.auth.auth import router as auth_router
from api.routers.campus_map.map import router as campus_map_router
from api.routers.health.health import router as health_router
from api.routers.locations.locations import router as locations_router
from api.routers.message.messages import router as messaging_router
from api.routers.testing.test import router as test_router
from api.routers.user.user import router as user_router

app = FastAPI(
    title="Campus Appointment and Tracking System",
    version="0.1.0",
    docs_url=None if enabled() else "/api/docs",
    openapi_url=None if enabled() else "/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081"
    ).split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


app.include_router(auth_router)
app.include_router(campus_map_router)

# this one says all is well in the world becuase it is
app.include_router(health_router, prefix="/api")
# this test says hello wolrd if all is well in the world
app.include_router(test_router, prefix="/api", dependencies=[Depends(require_user)])

app.include_router(user_router, prefix="/api")

# api for simple messaging
app.include_router(
    messaging_router, prefix="/api", dependencies=[Depends(require_user)]
)

# campus locations imported from OpenStreetMap
app.include_router(
    locations_router, prefix="/api", dependencies=[Depends(require_user)]
)
