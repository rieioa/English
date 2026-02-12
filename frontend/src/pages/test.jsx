/**
 * Test 페이지 컴포넌트.
 *
 * 이미지 업로드를 통해 상황을 분석하고,
 * AI가 생성한 영어 설명, 질문, 음성(TTS)을 제공하는 페이지이다.
 *
 * 주요 기능:
 * - 이미지 파일 업로드 및 미리보기
 * - FastAPI 백엔드(API /api/test/analyze) 호출
 * - 이미지 분석 결과(설명, 질문) 표시
 * - 생성된 영어 문장의 음성(TTS) 재생
 */

import { useState, useRef, useEffect } from "react";
import "./test.css";

const API_BASE_URL = "http://127.0.0.1:8000";

// 헬퍼 함수
function withTimeout(promise, ms, message) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function Test() {
  const [imagePreview, setImagePreview] = useState(null);
  const [question, setQuestion] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null); // GPT 질문 TTS
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [sessionId, setSessionId] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);

  const [feedbackResult, setFeedbackResult] = useState(null);
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState(null);

  const [status, setStatus] = useState("아바타 엔진 대기 중...");
  const [isConnected, setIsConnected] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(false);

  const avatarVideoRef = useRef(null);
  const avatarAudioRef = useRef(null);
  const synthesizerRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // SDK Status 조절(신경 안 써도 됨)
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.SpeechSDK?.AvatarSynthesizer) {
        setIsSdkReady(true);
        setStatus("엔진 로드 완료");
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // 아바타용 token 생성 시도 (WebRTC 연결 시도)
  const initializeWebRTC = async () => {
    if (!isSdkReady) return;
    setStatus("Azure 인증 및 WebRTC 연결 중...");

    try {
      const tokenResp = await fetch(`${API_BASE_URL}/api/azure/token`);
      if (!tokenResp.ok) throw new Error("get-speech-token failed");
      const { token, region } = await tokenResp.json();

      const iceResp = await fetch(`${API_BASE_URL}/api/azure/ice`);
      if (!iceResp.ok) throw new Error("get-avatar-ice failed");
      const iceRaw = await iceResp.json();

      const iceServers = [
        { urls: iceRaw.Urls, username: iceRaw.Username, credential: iceRaw.Password },
      ];

      const sdk = window.SpeechSDK;
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = "en-US-AvaMultilingualNeural";

      const avatarConfig = new sdk.AvatarConfig("lisa", "casual-sitting");
      const synthesizer = new sdk.AvatarSynthesizer(speechConfig, avatarConfig);
      synthesizerRef.current = synthesizer;

      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        const stream = event.streams?.[0];
        if (!stream) return;
        if (event.track.kind === "video") avatarVideoRef.current.srcObject = stream;
        if (event.track.kind === "audio") avatarAudioRef.current.srcObject = stream;
      };

      await withTimeout(
        synthesizer.startAvatarAsync(pc),
        20000,
        "startAvatarAsync timeout (20s). ICE/Network/Firewall 가능성 큼"
      );

      try { await avatarVideoRef.current?.play?.(); } catch {}
      try { await avatarAudioRef.current?.play?.(); } catch {}

      setIsConnected(true);
      setStatus("✅ 아바타 연결 완료");
    } catch (err) {
      console.error(err);
      setStatus(`❌ WebRTC 연결 실패: ${err?.message ?? String(err)}`);
    }
  };

  // 이미지 업로드 → GPT 분석 → 질문 TTS
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setQuestion(null);
    setAudioUrl(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/question`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      setQuestion(data.question);
      setSessionId(data.session_id || null);
      if (data.audio) {
        setAudioUrl(`data:audio/mp3;base64,${data.audio}`);
      }

      // 아바타가 질문을 바로 읽게끔
      if (
        isConnected &&
        typeof data.question === "string" &&
        data.question.trim()
      ) {
        try {
          setStatus("🗣️ 아바타가 질문을 읽는 중...");
          await speakAvatar(data.question);
          setStatus("🎤 질문을 들었습니다. 녹음을 시작하세요.");
        } catch (e) {
          console.warn("Avatar question speak failed:", e);
          setStatus("❌ 질문 발화 실패");
        }
      }

    } catch (err) {
      console.error(err);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 녹음본 백엔드로 전송 
  const postFeedback = async (audioBlob) => {
    if (!sessionId) {
      alert("session_id가 없습니다. 먼저 이미지를 업로드하세요.");
      return;
    }

    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("audio", audioBlob, "answer.webm");

    const resp = await fetch(`${API_BASE_URL}/api/feedback`, {
      method: "POST",
      body: fd,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`${resp.status} ${errText}`);
    }

    const data = await resp.json();

    setFeedbackResult(data.feedback);
    if (data.audio) {
      setFeedbackAudioUrl(`data:audio/mp3;base64,${data.audio}`);
    }

    // 아바타가 피드백을 바로 읽게끔
    if (typeof data.tts_text === "string" && data.tts_text.trim()) {
      try {
        await speakAvatar(data.tts_text);
      } catch (e) {
        console.warn("Avatar speakTextAsync failed:", e);
      }
    }
    return data;
  };

  // 아바타 발화 Promise Wrapper
  const speakAvatar = (text) =>
  new Promise((resolve, reject) => {
    const syn = synthesizerRef.current;
    if (!syn) return resolve(false); // 아바타 연결 안됐으면 스킵

    syn.speakTextAsync(
      text,
      () => resolve(true),
      (err) => reject(err)
    );
  });

  // 녹음 시작
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      setRecordedAudioUrl(url);
      setRecordedBlob(blob);

      try {
        // 녹음 종료 = 즉시 feedback 요청
        const feedbackData = await postFeedback(blob);
      } catch (e) {
        console.error(e);
        alert("피드백 처리 중 오류가 발생했습니다.");
      }
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
  };

  // 녹음 종료
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="page">
      <nav className="navbar">
        <h2 className="logo">AI Situation Tutor</h2>
        <span className="subtitle">English Learning Helper</span>
      </nav>

      <main className="container">
        {/* 왼쪽: 이미지 업로드 + 미리보기 */}
        <section className="left">
          <div className="upload-card">
            <div className="upload-box">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input"
              />
              <p className="upload-icon">📸</p>
              <p className="upload-title">사진을 여기에 드롭하거나 클릭하세요</p>
              <p className="upload-desc">분석하고 싶은 상황의 사진을 올려주세요</p>
            </div>
          </div>

          {imagePreview && (
            <div className="image-card">
              <img src={imagePreview} alt="preview" />
            </div>
          )}
        </section>

        {/* 오른쪽: GPT 질문 + TTS + 녹음 */}
        <section className="right">

          {!loading && !question && !recordedAudioUrl && (
            <div className="empty">
              사진을 업로드하면 질문과 녹음 기능이 활성화됩니다.
            </div>
          )}

          {question && (
            <div className="question-section">
              <h3>❓ Question</h3>
              <p>{question}</p>
            </div>
          )}

          <div className="avatar-view">
            <video ref={avatarVideoRef} autoPlay playsInline />
            <audio ref={avatarAudioRef} autoPlay />
          </div>

          <div className="avatar-connect">
            <button onClick={initializeWebRTC} disabled={isConnected}>
              {isConnected ? "🟢 Avatar Connected" : "🔌 Connect Avatar"}
            </button>
          {status && <p>{status}</p>}
          </div>

          {/* 녹음 버튼: 항상 상단 */}
          <div className="record-section">
            <h3>🎤 Record Your Answer</h3>
            {!recording && <button onClick={startRecording}>Start Recording</button>}
            {recording && <button onClick={stopRecording}>Stop Recording</button>}
            {recordedAudioUrl && (
              <div style={{ marginTop: "10px" }}>
                <p>Recorded Audio:</p>
                <audio controls src={recordedAudioUrl} />
              </div>
            )}
          </div>

          {/* 질문 + GPT TTS 오디오 */}
          {loading && <p>AI가 질문을 생성하고 있습니다...</p>}


          {feedbackResult && (
            <div className="feedback-section" style={{ marginTop: "20px" }}>
              <h3>✅ Feedback</h3>

              {/* Scores */}
              {feedbackResult.scores && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <span>Fluency: {feedbackResult.scores.fluency}/5</span>
                  <span>Grammar: {feedbackResult.scores.grammar}/5</span>
                  <span>Appropriateness: {feedbackResult.scores.appropriateness}/5</span>
                </div>
              )}

              {/* Bullets */}
              {Array.isArray(feedbackResult.feedback_bullets) && (
                <ul style={{ marginTop: "10px" }}>
                  {feedbackResult.feedback_bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}

              {/* Suggested Answer */}
              {feedbackResult.rewrites?.polite && (
                <div style={{ marginTop: "10px" }}>
                  <h4>💡 Suggested Answer</h4>
                  <p>{feedbackResult.rewrites.polite}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Test;