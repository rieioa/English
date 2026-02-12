from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from uuid import uuid4
import time

from app.services.vision_coach.question import generate_question
# 테스트용, 아래 import 줄 지울것
from app.services.vision_coach.feedback import generate_feedback
from app.services.vision_coach.transcribe import transcribe_uploadfile
from app.services.vision_coach.feedback_tts import *

router = APIRouter()
SESSION_STORE: dict[str, dict] = {}

@router.post("/question")
async def vc_question(image: UploadFile = File(...)):
    img_bytes = await image.read()
    mime = image.content_type or "image/jpeg"
    result = generate_question(img_bytes, mime=mime)

    session_id = str(uuid4())
    SESSION_STORE[session_id] = {
        "created_at": time.time(),
        "scene_summary": result["description"],     # feedback.py의 scene_summary로 사용
        "question": result["question"],      # 일단 1번 질문을 기본 질문으로 지정
    }

    return {
        "session_id": session_id,
        **result,
    }


@router.post("/feedback")
async def vc_feedback(    
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=400, detail="invalid session_id")
    
    user_answer_en = transcribe_uploadfile(audio)

    feedback = generate_feedback(
        question_en=session["question"],
        user_answer_en=user_answer_en,
        scene_summary=session.get("scene_summary"),
    )  
    tts_text = build_feedback_tts_text(feedback, include_followup=False)
    audio_b64 = tts_to_base64(tts_text)

    return {"feedback": feedback, "tts_text": tts_text, "audio": audio_b64}