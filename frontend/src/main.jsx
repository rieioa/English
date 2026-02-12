/**
 * React 애플리케이션의 엔트리 포인트.
 *
 * 역할:
 * - React DOM을 통해 앱을 실제 DOM에 마운트
 * - StrictMode로 개발 중 잠재적 문제 감지
 * - BrowserRouter로 클라이언트 사이드 라우팅 활성화
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

// root DOM 요소에 React 애플리케이션 렌더링
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 애플리케이션 전역 라우팅 설정 */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
