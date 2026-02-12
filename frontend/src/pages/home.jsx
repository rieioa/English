/**
 * Home 페이지 컴포넌트.
 *
 * AI 기반 영어 학습 애플리케이션의 메인 화면으로,
 * 사용자가 학습 모드를 선택할 수 있는 진입점 역할을 한다.
 *
 * 제공 기능:
 * - 이미지 기반 상황 분석 테스트 페이지 이동
 * - 말하기 연습(Speaking Practice) 페이지 이동
 */

import { useNavigate } from "react-router-dom";
import "./home.css";

function Home() {
  // 페이지 이동을 위한 React Router 훅
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-card">
        {/* 앱 타이틀 */}
        <h1 className="home-title">AI English Learning App</h1>

        {/* 앱 설명 */}
        <p className="home-subtitle">
          상황 분석과 말하기 연습을 통해 영어를 학습하세요
        </p>

        {/* 기능 선택 버튼 영역 */}
        <div className="home-buttons">
          <button
            className="home-btn test-btn"
            onClick={() => navigate("/app/test")}
          >
            📷 Situation Test
          </button>

          <button
            className="home-btn practice-btn"
            onClick={() => navigate("/app/practice")}
          >
            🎤 Speaking Practice
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
