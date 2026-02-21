import { type FC, useEffect, useRef, useState } from "react";
import { FONTS } from "./tokens";

interface WorldEventBannerProps {
  eventName: string;
  description: string;
  endsAt: number;
  totalNpcs: number;
  npcsDead: number;
  visible: boolean;
}

export const WorldEventBanner: FC<WorldEventBannerProps> = ({
  eventName,
  description,
  endsAt,
  totalNpcs,
  npcsDead,
  visible,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endsAt, visible]);

  if (!visible) return null;

  const progress = totalNpcs > 0 ? Math.min(1, npcsDead / totalNpcs) : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        pointerEvents: "none",
        animation: "bannerSlideIn 0.5s ease-out",
      }}
    >
      <style>{`
        @keyframes bannerSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes eventPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(220, 50, 50, 0.4); }
          50%       { box-shadow: 0 0 22px rgba(220, 50, 50, 0.8); }
        }
      `}</style>

      {/* Main banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30,8,8,0.96) 0%, rgba(60,12,12,0.94) 100%)",
          border: "1px solid rgba(200, 50, 50, 0.7)",
          borderRadius: "4px",
          padding: "10px 20px",
          minWidth: "320px",
          textAlign: "center",
          animation: "eventPulse 2s ease-in-out infinite",
        }}
      >
        {/* Skull icon + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <span
            style={{
              color: "#ff4444",
              fontWeight: "700",
              fontSize: "15px",
              fontFamily: FONTS.display,
              letterSpacing: "2px",
              textShadow: "0 0 8px rgba(255,68,68,0.6)",
            }}
          >
            {eventName.toUpperCase()}
          </span>
          <span style={{ fontSize: "18px" }}>⚠️</span>
        </div>

        {/* Description */}
        <div
          style={{
            color: "rgba(255,200,200,0.9)",
            fontSize: "12px",
            marginBottom: "8px",
            fontStyle: "italic",
          }}
        >
          {description}
        </div>

        {/* Progress bar */}
        {totalNpcs > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "rgba(255,180,180,0.8)",
                fontSize: "11px",
                marginBottom: "3px",
              }}
            >
              <span>Enemies slain</span>
              <span>
                {npcsDead} / {totalNpcs}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                background: "rgba(80, 10, 10, 0.8)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #cc2222, #ff6666)",
                  borderRadius: "3px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Timer */}
        <div
          style={{
            color: secondsLeft < 30 ? "#ff8844" : "rgba(255,180,180,0.7)",
            fontSize: "12px",
            letterSpacing: "1px",
          }}
        >
          ⏱ {timeStr}
        </div>
      </div>
    </div>
  );
};
