from fastapi import FastAPI

app = FastAPI(title="Campus Appointment and Tracking System", version="0.1.0")



@app.get("/health")
def health():
    return {"status": "ok"}