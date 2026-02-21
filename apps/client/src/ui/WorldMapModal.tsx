import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { FONTS } from "./tokens";

interface ZoneInfo {
  id: string;
  label: string;
  levelRange: string;
  description: string;
  icon: string;
  color: string;
  connections: string[];
}

const ZONES: ZoneInfo[] = [
  {
    id: "arena",
    label: "Arena",
    levelRange: "Lv. 1–10",
    description: "The starting grounds. Goblins, orcs, and wolves roam the plains.",
    icon: "⚔️",
    color: "#c8a84b",
    connections: ["forest"],
  },
  {
    id: "forest",
    label: "Whispering Forest",
    levelRange: "Lv. 8–20",
    description: "A dense forest filled with wolves, bears, and restless spirits.",
    icon: "🌲",
    color: "#4a9c4a",
    connections: ["arena", "dungeon"],
  },
  {
    id: "dungeon",
    label: "Catacombs",
    levelRange: "Lv. 18+",
    description: "Ancient ruins haunted by the undead and guarded by a fearsome dragon.",
    icon: "💀",
    color: "#7a4aa0",
    connections: ["forest"],
  },
];

interface WorldMapModalProps {
  currentMapName: string;
  onClose: () => void;
}

export const WorldMapModal: FC<WorldMapModalProps> = ({ currentMapName, onClose }) => {
  const { t } = useTranslation();
  // Normalize map name: "arena.test" → "arena", "forest" → "forest"
  const normalizedCurrentMap = currentMapName.split(".")[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, rgba(6,8,20,0.99) 0%, rgba(12,14,30,0.98) 100%)",
          border: "1px solid rgba(212,168,67,0.4)",
          borderRadius: "4px",
          padding: "32px",
          minWidth: "520px",
          maxWidth: "640px",
          boxShadow: "0 0 60px rgba(212,168,67,0.12), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              color: "rgba(212,168,67,0.95)",
              fontWeight: "700",
              fontSize: "18px",
              letterSpacing: "3px",
              textShadow: "0 0 10px rgba(212,168,67,0.4)",
              fontFamily: FONTS.display,
            }}
          >
            🗺 {t("ui.map.title")}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(212,168,67,0.6)",
              fontSize: "22px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Zone layout */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "22px",
          }}
        >
          {ZONES.map((zone, idx) => {
            const isCurrent = zone.id === normalizedCurrentMap;
            return (
              <div
                key={zone.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                {/* Connection line above (skip first) */}
                {idx > 0 && (
                  <div
                    style={{
                      width: "2px",
                      height: "18px",
                      background:
                        "linear-gradient(180deg, rgba(120,100,60,0.4) 0%, rgba(120,100,60,0.2) 100%)",
                      marginBottom: "4px",
                    }}
                  />
                )}

                {/* Zone card */}
                <div
                  style={{
                    width: "100%",
                    background: isCurrent
                      ? `linear-gradient(135deg, rgba(20,16,8,0.97) 0%, rgba(${hexToRgb(zone.color)},0.15) 100%)`
                      : "rgba(14,12,24,0.8)",
                    border: `1px solid ${isCurrent ? zone.color : "rgba(60,50,80,0.5)"}`,
                    borderRadius: "4px",
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "18px",
                    boxShadow: isCurrent
                      ? `0 0 20px ${zone.color}22, 0 4px 20px rgba(0,0,0,0.4)`
                      : "0 4px 12px rgba(0,0,0,0.3)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* You Are Here indicator */}
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "12px",
                        background: zone.color,
                        color: "#000",
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        letterSpacing: "1px",
                      }}
                    >
                      {t("ui.map.current_pos")}
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    style={{
                      fontSize: "36px",
                      flexShrink: 0,
                      filter: isCurrent ? "none" : "grayscale(0.4) opacity(0.7)",
                    }}
                  >
                    {zone.icon}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: isCurrent ? zone.color : "rgba(200,180,120,0.7)",
                        fontWeight: "700",
                        fontSize: "15px",
                        letterSpacing: "1px",
                        marginBottom: "3px",
                        textShadow: isCurrent ? `0 0 8px ${zone.color}66` : "none",
                      }}
                    >
                      {t(`maps.${zone.id}.name`, { defaultValue: zone.label })}
                    </div>
                    <div
                      style={{
                        color: "rgba(160,140,100,0.6)",
                        fontSize: "11px",
                        marginBottom: "5px",
                        fontWeight: "600",
                      }}
                    >
                      {zone.levelRange}
                    </div>
                    <div
                      style={{
                        color: "rgba(180,160,120,0.65)",
                        fontSize: "12px",
                        lineHeight: "1.5",
                      }}
                    >
                      {t(`maps.${zone.id}.desc`, { defaultValue: zone.description })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "22px",
            color: "rgba(140,120,80,0.5)",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          {t("ui.map.help")}
        </div>
      </div>
    </div>
  );
};

/** Converts "#rrggbb" to "r,g,b" for use in CSS rgba(). */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
