from api.routers.health.health import router as health_router
from api.routers.testing.test import router as test_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Campus Appointment and Tracking System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        #both of the front end ports need to be allowed
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_methods=["GET"],
)

#this one says all is well in the world becuase it is
app.include_router(health_router)
#this test says hello wolrd if all is well in the world
app.include_router(test_router)