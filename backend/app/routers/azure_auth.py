## Azure API Key 발급을 위한 백엔드 코드, 프런트엔드에서 호출해서 키만 받아감

from fastapi import APIRouter, HTTPException
import os, requests

router = APIRouter(prefix="/azure", tags=["azure"])

# --------------------------
# Speech Token
# --------------------------
@router.get("/token")
async def get_speech_token():
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        raise HTTPException(status_code=500, detail="Azure credentials missing in .env")

    fetch_token_url = (
        f"https://{speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    )
    headers = {"Ocp-Apim-Subscription-Key": speech_key}

    try:
        response = requests.post(fetch_token_url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"Azure Token Error: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail="Failed to fetch token from Azure",
            )
        return {"token": str(response.text), "region": speech_region}
    except Exception as e:
        print(f"Token Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------
# Avatar ICE (TURN/STUN)
# --------------------------
@router.get("/ice")
async def get_avatar_ice():
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        raise HTTPException(status_code=500, detail="Azure credentials missing in .env")

    url = f"https://{speech_region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"
    headers = {"Ocp-Apim-Subscription-Key": speech_key}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            print("Azure ICE Error:", resp.text)
            raise HTTPException(
                status_code=resp.status_code, detail="Failed to fetch Avatar ICE config"
            )
        return resp.json()  # 보통 { Urls, Username, Password }
    except Exception as e:
        print("ICE Fetch Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
