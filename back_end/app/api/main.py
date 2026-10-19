from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.health.health import router as health_router
from api.routers.message.messages import router as messaging_router
from api.routers.testing.counting import router as counter_router
from api.routers.testing.test import router as test_router

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


# this one says all is well in the world becuase it is
app.include_router(health_router)
# this test says hello wolrd if all is well in the world
app.include_router(test_router)
# api for simple messaging
app.include_router(messaging_router)

app.include_router(counter_router)
