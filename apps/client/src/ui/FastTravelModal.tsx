import { type FC } from "react";
import type { FastTravelWaypoint } from "@abraxas/shared";

interface FastTravelModalProps {
  waypoints: FastTravelWaypoint[];
  currentMapName: string;
  onTravel: (waypointId: string) => void;
  onClose: () => void;
}

export const FastTravelModal: FC<FastTravelModalProps> = ({
  waypoints,
  currentMapName,
  onTravel,
  onClose,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, rgba(10,8,22,0.98) 0%, rgba(18,12,40,0.97) 100%)",
          border: "1px solid rgba(120,90,200,0.5)",
          borderRadius: "14px",
          padding: "28px 32px",
          minWidth: "320px",
          maxWidth: "420px",
          boxShadow: "0 0 40px rgba(100,70,200,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(180, 150, 255, 0.95)",
                fontWeight: "bold",
                fontSize: "16px",
                letterSpacing: "2px",
                textShadow: "0 0 8px rgba(150,100,255,0.5)",
              }}
            >
              ✦ FAST TRAVEL
            </div>
            <div
              style={{
                color: "rgba(150,130,180,0.7)",
                fontSize: "11px",
                marginTop: "2px",
              }}
            >
              {currentMapName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(180,150,255,0.6)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Waypoint list */}
        {waypoints.length === 0 ? (
          <div
            style={{
              color: "rgba(180,150,255,0.5)",
              textAlign: "center",
              fontSize: "13px",
              padding: "16px 0",
              fontStyle: "italic",
            }}
          >
            No waypoints discovered on this map.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {waypoints.map((wp) => (
              <button
                key={wp.id}
                onClick={() => {
                  onTravel(wp.id);
                  onClose();
                }}
                style={{
                  background: "rgba(80,50,160,0.25)",
                  border: "1px solid rgba(120,90,200,0.4)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.15s ease",
                  color: "rgba(210,190,255,0.9)",
                  fontSize: "14px",
                  fontWeight: "500",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(100,70,200,0.45)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(150,120,255,0.7)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(80,50,160,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(120,90,200,0.4)";
                }}
              >
                <span style={{ fontSize: "20px" }}>🌀</span>
                <div>
                  <div>{wp.label}</div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(160,140,200,0.6)",
                      marginTop: "2px",
                    }}
                  >
                    ({wp.x}, {wp.y})
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: "18px",
            color: "rgba(140,120,180,0.5)",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          Press ESC to close
        </div>
      </div>
    </div>
  );
};
