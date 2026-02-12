"""
이미지 기반 영어 학습 API 라우터.

- 업로드된 이미지를 분석하여 상황 설명 생성
- 이미지 상황에 대한 자연스러운 영어 질문 생성
- 생성된 텍스트를 음성(TTS)으로 변환하여 제공
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
import base64
import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# 환경 변수 로드 (.env 파일)
load_dotenv()

# API 라우터 인스턴스 생성
router = APIRouter()

# OpenAI API 키 로드 및 검증
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("❌ OPENAI_API_KEY가 설정되지 않았습니다.")

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=api_key)

def generate_question(image_bytes: bytes, mime: str = "image/jpeg"):

    """
    Returns:
        dict: 이미지 분석 결과 및 음성 데이터
            {
                "description": str,   # 이미지 상황 설명
                "questions": list,    # 영어 질문 목록
                "audio": str          # Base64 인코딩된 음성 데이터
            }

    Raises:
        HTTPException: 이미지 처리 또는 OpenAI API 호출 중 오류 발생 시
    """
    try:
        # 이미지 파일을 Base64로 인코딩
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # GPT Vision에 전달할 프롬프트
        prompt = """
            You are an English learning assistant.

            1. Analyze the situation in the image.
            2. Describe the situation in 2-3 sentences.
            3. Generate 5 natural English questions about this situation.

            Return ONLY valid JSON in this format:
            {
            "description": "...",
            "questions": ["...", "..."]
            }
        """

        # GPT Vision 모델 호출
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        # 응답 JSON 파싱
        content = response.choices[0].message.content
        parsed = json.loads(content)

        # TTS 변환용 텍스트 생성
        first_question = parsed["questions"][0]

        # 텍스트를 음성으로 변환
        audio_response = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice="alloy",
            input=first_question,
        )

        # 음성 데이터를 Base64로 인코딩
        audio_base64 = base64.b64encode(audio_response.content).decode("utf-8")

        return {
            "description": parsed["description"],
            "question": parsed["questions"][0],
            "audio": audio_base64,
        }

    except Exception as e:
        print("Server Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
