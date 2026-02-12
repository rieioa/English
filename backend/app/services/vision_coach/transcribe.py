## 사용자 피드백(음성)을 텍스트로 변환, GPT에게 넘겨주기 위한 코드

import os
import tempfile
from fastapi import UploadFile, HTTPException
from openai import OpenAI

# 허용 확장자 (브라우저 녹음은 보통 webm)
ALLOWED_EXT = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
MAX_BYTES = 25 * 1024 * 1024  # 25MB


def transcribe_uploadfile(audio: UploadFile) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")

    client = OpenAI(api_key=api_key)

    if not audio.filename:
        raise HTTPException(status_code=400, detail="audio file is required")

    ext = audio.filename.rsplit(".", 1)[-1].lower() if "." in audio.filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: .{ext}. Supported: {sorted(ALLOWED_EXT)}",
        )

    try:
        data = audio.file.read()  # UploadFile의 내부 파일 스트림
        if not data:
            raise HTTPException(status_code=400, detail="Empty audio file")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

        # SDK에 file-like을 주기 위해 임시파일 사용
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=True) as tmp:
            tmp.write(data)
            tmp.flush()

            with open(tmp.name, "rb") as f:
                resp = client.audio.transcriptions.create(
                    model="gpt-4o-mini-transcribe",  # 또는 "whisper-1"
                    file=f,
                    response_format="json",
                )

        text = getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else None)
        if not text:
            raise HTTPException(status_code=502, detail="Transcription returned empty text")
        return text

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT failed: {e}")
