from fastapi import APIRouter

router = APIRouter(tags=["Test"])

@router.get("/test")
def test():
    return {"message": "hello wolrd"}