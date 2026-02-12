/**
 * 애플리케이션 라우팅 설정 컴포넌트.
 *
 * React Router를 사용하여 각 페이지 경로와
 * 해당 컴포넌트를 매핑한다.
 *
 * 라우팅 구조:
 * - /            → /app 으로 리다이렉트
 * - /app         → 홈(Home) 페이지
 * - /app/test    → AI 이미지 분석 테스트 페이지
 * - /app/practice→ 말하기 연습(Practice) 페이지
 */

import { Routes, Route, Navigate } from "react-router-dom";
import Test from "./pages/test";
import Practice from "./pages/practice";
import Home from "./pages/home";

function App() {
  return (
    <Routes>
      {/* 루트 경로 접근 시 홈 페이지로 리다이렉트 */}
      <Route path="/" element={<Navigate to="/app" />} />

      {/* 홈 페이지 */}
      <Route path="/app" element={<Home />} />

      {/* AI 이미지 분석 테스트 페이지 */}
      <Route path="/app/test" element={<Test />} />

      {/* 말하기 연습 페이지 */}
      <Route path="/app/practice" element={<Practice />} />
    </Routes>
  );
}

export default App;
