import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI

from app.routers.vision_coach_router import router as vc_router
from app.routers.azure_auth import router as az_router

load_dotenv()
assert os.getenv("OPENAI_API_KEY"), "OPENAI_API_KEY is missing"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],  # 개발용: 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vc_router, prefix="/api")
app.include_router(az_router, prefix="/api")


if os.getenv("PRINT_MODELS") == "1":
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    models = client.models.list()
    for m in models.data:
        print(m.id)


# uvicorn app.main:app --reload --port 8000
