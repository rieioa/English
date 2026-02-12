# app/services/vision_coach/tts.py
import base64
import os
from openai import OpenAI


def build_feedback_tts_text(feedback: dict, include_followup: bool = False) -> str:
    """
    추천 1순위 포맷:
      - quick feedback (요약)
      - bullets 1~2개
      - model answer (rewrites.polite)
      - (옵션) follow-up question

    include_followup=False면 followup_question은 제외.
    """
    parts: list[str] = ["Here's some quick feedback."]

    bullets = feedback.get("feedback_bullets") or []
    if isinstance(bullets, list) and bullets:
        # 너무 길어지는 거 방지: 앞 2개만
        parts.append(str(bullets[0]))
        if len(bullets) > 1:
            parts.append(str(bullets[1]))

    polite = (feedback.get("rewrites") or {}).get("polite")
    if polite:
        parts.append("A more natural answer would be:")
        parts.append(str(polite))

    if include_followup:
        followup = feedback.get("followup_question")
        if followup:
            parts.append("Next question.")
            parts.append(str(followup))

    # 문장 간 간격/발화 자연스러움 위해 join은 공백으로
    return " ".join(parts).strip()


def tts_to_base64(text: str, voice: str = "alloy", model: str = "gpt-4o-mini-tts") -> str:
    """
    텍스트를 TTS로 변환해서 base64(audio bytes)를 반환.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing")

    if not text or not text.strip():
        raise ValueError("TTS input text is empty")

    client = OpenAI(api_key=api_key)

    resp = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text.strip(),
    )

    return base64.b64encode(resp.content).decode("utf-8")
