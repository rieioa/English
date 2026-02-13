# English
------------------------------------
## Backend

1. 가상환경 실행
source venv/bin/activate

2. .env파일 수정

3. python -m pip install -r requirements.txt

4. uvicorn app.main:app --reload --port 8000

backend/routers: /api 로 들어오는 링크에 대한 반환 정의
backend/services/vision_coach: 라우터 내부 함수들 다 여기 있음

백엔드 엔트포인트
http://localhost:8000/api/azure/token
http://localhost:8000/api/azure/ice
http://localhost:8000/api/question
http://localhost:8000/api/feedback

--------------------------------------
## Frontend
http://localhost:5173/app/test

1. npm run dev(노션참조)


