# app/services/vision_coach/feedback.py

import json
import os
import re
from openai import OpenAI

_CODEBLOCK_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)

def _safe_json_parse(text: str) -> dict:
    """
    모델이 ```json ...``` 로 감싸서 주거나, 앞뒤에 잡텍스트가 섞여도 최대한 파싱.
    """
    if not text:
        return {"raw": text}

    cleaned = text.strip()
    cleaned = _CODEBLOCK_RE.sub("", cleaned).strip()

    # 가장 바깥 JSON 객체만 뽑아보는 시도
    if "{" in cleaned and "}" in cleaned:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        cand = cleaned[start : end + 1]
    else:
        cand = cleaned

    try:
        return json.loads(cand)
    except Exception:
        return {"raw": text, "cleaned": cleaned}


def generate_feedback(
    question_en: str,
    user_answer_en: str,
    scene_summary: str | None = None,
) -> dict:
    """
    입력:
      - question_en: question.py가 만든 질문(영어)
      - user_answer_en: 유저 답변(영어 텍스트; STT 결과든 직접 입력이든)
      - scene_summary: optional (question.py가 같이 주는 장면 요약)

    출력(JSON dict):
      - scores: fluency/grammar/appropriateness (1~5)
      - feedback_bullets: 핵심 피드백 3개
      - corrections: 교정 포인트(원문/수정/이유)
      - rewrites: 더 자연스러운 답변 2종 (polite/casual)
      - micro_lesson: 짧은 미니레슨
      - followup_question: 다음 질문 1개
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing")

    client = OpenAI(api_key=api_key)

    system_rules = (
        "You are an English conversation coach. "
        "Give practical corrections for real-life spoken English. "
        "Be concise and helpful."
    )

    # JSON 강제(마크다운/코드블록 금지)
    instruction = (
        "Return ONLY valid JSON (no markdown, no code fences). "
        "Use this schema:\n"
        "{\n"
        '  "scores": {"fluency": 1-5, "grammar": 1-5, "appropriateness": 1-5},\n'
        '  "feedback_bullets": ["...", "...", "..."],\n'
        '  "corrections": [{"original":"...","fixed":"...","why":"..."}],\n'
        '  "rewrites": {"polite":"...","casual":"..."},\n'
        '  "micro_lesson": "1-2 sentences",\n'
        '  "followup_question": "one short question"\n'
        "}\n"
        "Rules:\n"
        "- Keep feedback_bullets exactly 3 items.\n"
        "- corrections can be empty if already good.\n"
        "- rewrites should preserve meaning.\n"
    )

    context = ""
    if scene_summary:
        context = f"Scene summary: {scene_summary}\n"

    user_msg = (
        f"{context}"
        f"Question: {question_en}\n"
        f"User answer: {user_answer_en}\n\n"
        f"{instruction}"
    )

    resp = client.responses.create(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system_rules}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_msg}]},
        ],
        # 너무 길어지는 거 방지
        max_output_tokens=450,
    )

    return _safe_json_parse(getattr(resp, "output_text", "") or "")
