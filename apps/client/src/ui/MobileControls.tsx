import { Box } from "@chakra-ui/react";
import { useCallback, useRef } from "react";
import { Direction } from "@abraxas/shared";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords } from "lucide-react";
import { T } from "./tokens";

type SpellSlot = {
  key: string;
  spellId: string;
  rangeTiles: number;
};

type MobileControlsProps = {
  onMove: (direction: Direction) => void;
  onAttack: () => void;
  onSpell: (spellId: string, rangeTiles: number) => void;
  spells: SpellSlot[];
};

const BTN_SIZE = "60px";
const BTN_BG = "rgba(10, 8, 20, 0.75)";
const BTN_BORDER = "1px solid rgba(212, 168, 67, 0.35)";
const BTN_ACTIVE_BG = "rgba(212, 168, 67, 0.25)";
const BTN_ACTIVE_BORDER = "1px solid rgba(212, 168, 67, 0.8)";

const DIRECTION_ICONS = {
  [Direction.UP]: ChevronUp,
  [Direction.DOWN]: ChevronDown,
  [Direction.LEFT]: ChevronLeft,
  [Direction.RIGHT]: ChevronRight,
} as const;

type DPadButtonProps = {
  direction: Direction;
  style?: React.CSSProperties;
  onMove: (direction: Direction) => void;
};

function DPadButton({ direction, style, onMove }: DPadButtonProps) {
  const Icon = DIRECTION_ICONS[direction];
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const start = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (activeRef.current) return;
      activeRef.current = true;
      onMove(direction);
      intervalRef.current = setInterval(() => {
        onMove(direction);
      }, 80);
    },
    [direction, onMove],
  );

  const stop = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    activeRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return (
    <Box
      position="absolute"
      w={BTN_SIZE}
      h={BTN_SIZE}
      bg={BTN_BG}
      border={BTN_BORDER}
      borderRadius="8px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      color="rgba(212, 168, 67, 0.9)"
      userSelect="none"
      cursor="pointer"
      style={style}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      _active={{ bg: BTN_ACTIVE_BG, border: BTN_ACTIVE_BORDER }}
    >
      <Icon size={28} />
    </Box>
  );
}

type ActionButtonProps = {
  label: string;
  color?: string;
  bg?: string;
  border?: string;
  w?: string;
  h?: string;
  fontSize?: string;
  onAction: () => void;
};

function ActionButton({
  label,
  color = "rgba(212, 168, 67, 0.9)",
  bg = BTN_BG,
  border = BTN_BORDER,
  w = BTN_SIZE,
  h = BTN_SIZE,
  fontSize = "11px",
  onAction,
}: ActionButtonProps) {
  const handle = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onAction();
    },
    [onAction],
  );

  return (
    <Box
      w={w}
      h={h}
      bg={bg}
      border={border}
      borderRadius="8px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize={fontSize}
      fontWeight="700"
      fontFamily={T.display}
      letterSpacing="0.5px"
      color={color}
      userSelect="none"
      cursor="pointer"
      textAlign="center"
      px="4px"
      onPointerDown={handle}
      _active={{ bg: BTN_ACTIVE_BG, border: BTN_ACTIVE_BORDER }}
    >
      {label}
    </Box>
  );
}

export function MobileControls({ onMove, onAttack, onSpell, spells }: MobileControlsProps) {
  const dpadCenterSize = 60;
  const dpadGap = 4;
  const dpadTotal = dpadCenterSize * 3 + dpadGap * 2;

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      height="200px"
      pointerEvents="none"
      zIndex={50}
      display="flex"
      alignItems="flex-end"
      justifyContent="space-between"
      px="16px"
      pb="20px"
    >
      {/* D-pad */}
      <Box
        position="relative"
        w={`${dpadTotal}px`}
        h={`${dpadTotal}px`}
        pointerEvents="auto"
        flexShrink="0"
      >
        <DPadButton
          direction={Direction.UP}
          onMove={onMove}
          style={{ top: 0, left: `${dpadCenterSize + dpadGap}px` }}
        />
        <DPadButton
          direction={Direction.LEFT}
          onMove={onMove}
          style={{ top: `${dpadCenterSize + dpadGap}px`, left: 0 }}
        />
        {/* Center decorative */}
        <Box
          position="absolute"
          w={BTN_SIZE}
          h={BTN_SIZE}
          bg="rgba(10, 8, 20, 0.6)"
          border="1px solid rgba(46, 40, 64, 0.4)"
          borderRadius="8px"
          style={{
            top: `${dpadCenterSize + dpadGap}px`,
            left: `${dpadCenterSize + dpadGap}px`,
          }}
        />
        <DPadButton
          direction={Direction.RIGHT}
          onMove={onMove}
          style={{
            top: `${dpadCenterSize + dpadGap}px`,
            left: `${(dpadCenterSize + dpadGap) * 2}px`,
          }}
        />
        <DPadButton
          direction={Direction.DOWN}
          onMove={onMove}
          style={{
            top: `${(dpadCenterSize + dpadGap) * 2}px`,
            left: `${dpadCenterSize + dpadGap}px`,
          }}
        />
      </Box>

      {/* Right action panel */}
      <Box
        display="flex"
        flexDir="column"
        alignItems="flex-end"
        gap="8px"
        pointerEvents="auto"
        flexShrink="0"
      >
        {/* Spell row */}
        {spells.length > 0 && (
          <Box display="flex" gap="8px">
            {spells.map((s) => (
              <ActionButton
                key={s.spellId}
                label={s.key}
                onAction={() => onSpell(s.spellId, s.rangeTiles)}
                color="rgba(100, 180, 255, 0.9)"
                bg="rgba(10, 8, 30, 0.75)"
                border="1px solid rgba(100, 180, 255, 0.35)"
                fontSize="14px"
              />
            ))}
          </Box>
        )}

        {/* Attack button */}
        <Box
          w="130px"
          h={BTN_SIZE}
          bg="rgba(30, 8, 8, 0.8)"
          border="1px solid rgba(220, 80, 80, 0.5)"
          borderRadius="8px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="6px"
          color="rgba(220, 80, 80, 0.95)"
          userSelect="none"
          cursor="pointer"
          onPointerDown={(e: React.PointerEvent) => { e.preventDefault(); onAttack(); }}
          _active={{ bg: BTN_ACTIVE_BG, border: BTN_ACTIVE_BORDER }}
        >
          <Swords size={20} />
        </Box>
      </Box>
    </Box>
  );
}
