import Phaser from "phaser";
import type { NetworkManager } from "../network/NetworkManager";
import { Direction, CLASS_STATS, SPELLS } from "@abraxas/shared";

const KEY_TO_DIRECTION: Record<number, Direction> = {
  [Phaser.Input.Keyboard.KeyCodes.UP]: Direction.UP,
  [Phaser.Input.Keyboard.KeyCodes.DOWN]: Direction.DOWN,
  [Phaser.Input.Keyboard.KeyCodes.LEFT]: Direction.LEFT,
  [Phaser.Input.Keyboard.KeyCodes.RIGHT]: Direction.RIGHT,
};

const SPELL_KEY_CODES: Record<string, number> = {
  Q: Phaser.Input.Keyboard.KeyCodes.Q,
  W: Phaser.Input.Keyboard.KeyCodes.W,
  E: Phaser.Input.Keyboard.KeyCodes.E,
  R: Phaser.Input.Keyboard.KeyCodes.R,
};

export interface TargetingState {
  mode: "spell" | "attack";
  spellId?: string;
  rangeTiles: number;
}

export class InputHandler {
  private scene: Phaser.Scene;
  private network: NetworkManager;
  private meleeRange: number;
  private moveKeys: Record<number, Phaser.Input.Keyboard.Key> = {};
  private ctrlKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private spellKeys: {
    key: Phaser.Input.Keyboard.Key;
    spellId: string;
    rangeTiles: number;
  }[] = [];
  private lastMoveSentMs = 0;
  private moveIntervalMs: number;
  private onLocalMove?: (direction: Direction) => void;
  private onEnterTargeting?: (rangeTiles: number) => void;
  private onExitTargeting?: () => void;
  private onInteract?: (tileX: number, tileY: number) => void;
  private onPttStart?: () => void;
  private onPttEnd?: () => void;
  private pttKey!: Phaser.Input.Keyboard.Key;

  targeting: TargetingState | null = null;

  // Click events queued by Phaser's pointer event system, consumed in update()
  private pendingLeftClick = false;
  private pendingRightClick = false;

  constructor(
    scene: Phaser.Scene,
    network: NetworkManager,
    classType: string,
    tileSize: number,
    onLocalMove?: (direction: Direction) => void,
    onEnterTargeting?: (rangeTiles: number) => void,
    onExitTargeting?: () => void,
    onInteract?: (tileX: number, tileY: number) => void,
    onPttStart?: () => void,
    onPttEnd?: () => void,
  ) {
    this.scene = scene;
    this.network = network;
    this.onLocalMove = onLocalMove;
    this.onEnterTargeting = onEnterTargeting;
    this.onExitTargeting = onExitTargeting;
    this.onInteract = onInteract;
    this.onPttStart = onPttStart;
    this.onPttEnd = onPttEnd;

    const stats = CLASS_STATS[classType];
    this.moveIntervalMs = 1000 / stats.speedTilesPerSecond;
    this.meleeRange = stats.meleeRange;

    // Listen for pointer clicks via Phaser's event system
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.pendingLeftClick = true;
      }
      if (pointer.rightButtonDown()) {
        this.pendingRightClick = true;
      }
    });

    if (scene.input.keyboard) {
      // Arrow keys
      for (const keyCode of [
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
      ]) {
        this.moveKeys[keyCode] = scene.input.keyboard.addKey(keyCode);
      }

      this.ctrlKey = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.CTRL,
      );

      this.escKey = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC,
      );

      this.pttKey = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.V,
      );

      // Dynamic spell keybinds from class config
      for (const spellId of stats.spells) {
        const spell = SPELLS[spellId];
        if (!spell) continue;
        const keyCode = SPELL_KEY_CODES[spell.key];
        if (keyCode != null) {
          this.spellKeys.push({
            key: scene.input.keyboard.addKey(keyCode),
            spellId: spell.id,
            rangeTiles: spell.rangeTiles,
          });
        }
      }
    }
  }

  private enterTargeting(state: TargetingState) {
    this.targeting = state;
    this.onEnterTargeting?.(state.rangeTiles);
  }

  cancelTargeting() {
    if (this.targeting) {
      this.targeting = null;
      this.onExitTargeting?.();
    }
  }

  update(time: number, getMouseTile: () => { x: number; y: number }) {
    const now = time;

    // Consume queued click events
    const leftClicked = this.pendingLeftClick;
    const rightClicked = this.pendingRightClick;
    this.pendingLeftClick = false;
    this.pendingRightClick = false;

    // Push-to-Talk
    if (this.pttKey) {
      if (Phaser.Input.Keyboard.JustDown(this.pttKey)) {
        this.onPttStart?.();
      } else if (Phaser.Input.Keyboard.JustUp(this.pttKey)) {
        this.onPttEnd?.();
      }
    }

    // Movement: check held keys and repeat at interval (works in both idle and targeting)
    for (const [keyCode, key] of Object.entries(this.moveKeys)) {
      if (key.isDown) {
        if (now - this.lastMoveSentMs >= this.moveIntervalMs) {
          const direction = KEY_TO_DIRECTION[Number(keyCode)];
          if (direction) {
            this.network.sendMove(direction);
            this.onLocalMove?.(direction);
            this.lastMoveSentMs += this.moveIntervalMs;
            if (now - this.lastMoveSentMs > this.moveIntervalMs) {
              this.lastMoveSentMs = now;
            }
          }
        }
        break; // Only one direction at a time, first held wins
      }
    }

    // --- Targeting mode ---
    if (this.targeting) {
      // ESC or right-click: cancel targeting
      if (Phaser.Input.Keyboard.JustDown(this.escKey) || rightClicked) {
        this.cancelTargeting();
        return;
      }

      // Left-click: confirm target
      if (leftClicked) {
        const mouseTile = getMouseTile();
        if (this.targeting.mode === "spell") {
          this.network.sendCast(
            this.targeting.spellId!,
            mouseTile.x,
            mouseTile.y,
          );
        } else {
          // attack mode (ranged attack)
          this.network.sendAttack(mouseTile.x, mouseTile.y);
        }
        this.cancelTargeting();
        return;
      }

      // Spell keys while targeting: switch to that spell (or cast immediately if self-target)
      for (const { key, spellId, rangeTiles } of this.spellKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          if (rangeTiles > 0) {
            // Switch targeting to this spell
            this.cancelTargeting();
            this.enterTargeting({ mode: "spell", spellId, rangeTiles });
          } else {
            // Self-target spell: cast immediately, exit targeting
            this.cancelTargeting();
            this.network.sendCast(spellId, 0, 0);
          }
          return;
        }
      }

      // CTRL while targeting: switch to attack targeting if ranged, or do melee attack
      if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
        if (this.meleeRange > 1) {
          this.cancelTargeting();
          this.enterTargeting({ mode: "attack", rangeTiles: this.meleeRange });
        } else {
          this.cancelTargeting();
          this.network.sendAttack();
        }
        return;
      }

      return;
    }

    // --- Idle mode ---

    // Attack (CTRL)
    if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
      if (this.meleeRange > 1) {
        // Ranged class (archer): enter targeting mode
        this.enterTargeting({ mode: "attack", rangeTiles: this.meleeRange });
      } else {
        // Melee class: attack immediately
        this.network.sendAttack();
      }
    }

    // Left-click: interact or select target
    if (leftClicked) {
      this.onInteract?.(getMouseTile().x, getMouseTile().y);
    }

    // Spell keys (Q/W/E/R)
    for (const { key, spellId, rangeTiles } of this.spellKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        if (rangeTiles > 0) {
          // Targeted spell: enter targeting mode
          this.enterTargeting({ mode: "spell", spellId, rangeTiles });
        } else {
          // Self-target spell: cast immediately
          this.network.sendCast(spellId, 0, 0);
        }
      }
    }
  }

  destroy() {
    this.scene.input.off("pointerdown");
  }
}
