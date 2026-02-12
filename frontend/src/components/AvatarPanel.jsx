import { useEffect, useRef } from "react";

export default function AvatarPanel({ avatar }) {
  const videoRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;   // ✅ 중복 init 방지
    startedRef.current = true;
    avatar.init(videoRef.current).catch(console.error);
  }, [avatar]);

  return (
    <div style={{ marginBottom: 16 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: 220, borderRadius: 10 }}
      />
    </div>
  );
}
