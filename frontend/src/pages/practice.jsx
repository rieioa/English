import { useState, useRef, useEffect } from "react";
import "./practice.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function withTimeout(promise, ms, message) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function Test() {
  const [fileInfo, setFileInfo] = useState(null);
  const [question, setQuestion] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [sessionId, setSessionId] = useState(null);
  const [feedbackResult, setFeedbackResult] = useState(null);

  const [status, setStatus] = useState("아바타 엔진 대기 중...");
  const [isConnected, setIsConnected] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(false);

  const avatarVideoRef = useRef(null);
  const avatarAudioRef = useRef(null);
  const synthesizerRef = useRef(null);

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

  const initializeWebRTC = async () => {
    if (!isSdkReady) return;
    setStatus("Azure 인증 및 WebRTC 연결 중...");

    try {
      const tokenResp = await fetch(`${API_BASE_URL}/api/azure/token`);
      const { token, region } = await tokenResp.json();

      const iceResp = await fetch(`${API_BASE_URL}/api/azure/ice`);
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
        "startAvatarAsync timeout"
      );

      try { await avatarVideoRef.current?.play?.(); } catch {}
      try { await avatarAudioRef.current?.play?.(); } catch {}

      setIsConnected(true);
      setStatus("✅ 아바타 연결 완료");
    } catch (err) {
      setStatus(`❌ WebRTC 연결 실패: ${err?.message ?? String(err)}`);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      type: file.type || "unknown",
    });

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

      if (isConnected && data.question) {
        setStatus("🗣️ 아바타가 질문을 읽는 중...");
        await speakAvatar(data.question);
        setStatus("🎤 질문을 들었습니다. 녹음을 시작하세요.");
      }

    } catch (err) {
      console.error(err);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const postFeedback = async (audioBlob) => {
    if (!sessionId) return;

    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("audio", audioBlob, "answer.webm");

    const resp = await fetch(`${API_BASE_URL}/api/feedback`, {
      method: "POST",
      body: fd,
    });

    const data = await resp.json();
    setFeedbackResult(data.feedback);

    if (data.tts_text) await speakAvatar(data.tts_text);
  };

  const speakAvatar = (text) =>
    new Promise((resolve, reject) => {
      const syn = synthesizerRef.current;
      if (!syn) return resolve(false);
      syn.speakTextAsync(text, () => resolve(true), reject);
    });

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
      await postFeedback(blob);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
  };

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
        <section className="left">
          <div className="upload-card">
            <div className="upload-box">
              <input
                type="file"
                onChange={handleFileChange}
                className="file-input"
              />
              <p className="upload-icon">📎</p>
              <p className="upload-title">파일을 업로드하세요</p>
              <p className="upload-desc">이미지 포함 모든 파일 가능</p>
            </div>
          </div>

          {fileInfo && (
            <div className="image-card">
              <p><b>파일명:</b> {fileInfo.name}</p>
            </div>
          )}
        </section>

        <section className="right">
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

          <div className="record-section">
            <h3>🎤 Record Your Answer</h3>
            {!recording && <button onClick={startRecording}>Start Recording</button>}
            {recording && <button onClick={stopRecording}>Stop Recording</button>}
            {recordedAudioUrl && <audio controls src={recordedAudioUrl} />}
          </div>

          {feedbackResult && (
            <div className="feedback-section">
              <h3>✅ Feedback</h3>
              {feedbackResult.feedback_bullets?.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Test;
