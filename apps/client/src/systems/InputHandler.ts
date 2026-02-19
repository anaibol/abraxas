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

type TargetingState =
  | { mode: "spell"; spellId: string; rangeTiles: number }
  | { mode: "attack"; rangeTiles: number };

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

  private pendingLeftClick = false;
  private pendingRightClick = false;

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.leftButtonDown()) this.pendingLeftClick = true;
    if (pointer.rightButtonDown()) this.pendingRightClick = true;
  };

  constructor(
    scene: Phaser.Scene,
    network: NetworkManager,
    classType: string,
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
    const speed = stats.speedTilesPerSecond;
    this.moveIntervalMs = 1000 / speed;
    this.meleeRange = stats.meleeRange;

    scene.input.on("pointerdown", this.onPointerDown);

    if (scene.input.keyboard) {
      for (const keyCode of [
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
      ]) {
        this.moveKeys[keyCode] = scene.input.keyboard.addKey(keyCode);
      }

      this.ctrlKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
      this.escKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.pttKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);

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
    const leftClicked = this.pendingLeftClick;
    const rightClicked = this.pendingRightClick;
    this.pendingLeftClick = false;
    this.pendingRightClick = false;

    if (this.pttKey) {
      if (Phaser.Input.Keyboard.JustDown(this.pttKey)) {
        this.onPttStart?.();
      } else if (Phaser.Input.Keyboard.JustUp(this.pttKey)) {
        this.onPttEnd?.();
      }
    }

    for (const [keyCode, key] of Object.entries(this.moveKeys)) {
      if (key.isDown) {
        if (time - this.lastMoveSentMs >= this.moveIntervalMs) {
          const direction = KEY_TO_DIRECTION[Number(keyCode)];
          if (direction !== undefined) {
            this.network.sendMove(direction);
            this.onLocalMove?.(direction);
            this.lastMoveSentMs += this.moveIntervalMs;
            if (time - this.lastMoveSentMs > this.moveIntervalMs) {
              this.lastMoveSentMs = time;
            }
          }
        }
        break;
      }
    }

    if (this.targeting) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey) || rightClicked) {
        this.cancelTargeting();
        return;
      }

      if (leftClicked) {
        const mouseTile = getMouseTile();
        if (this.targeting.mode === "spell") {
          this.network.sendCast(this.targeting.spellId, mouseTile.x, mouseTile.y);
        } else {
          this.network.sendAttack(mouseTile.x, mouseTile.y);
        }
        this.cancelTargeting();
        return;
      }

      for (const { key, spellId, rangeTiles } of this.spellKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          this.cancelTargeting();
          if (rangeTiles > 0) {
            this.enterTargeting({ mode: "spell", spellId, rangeTiles });
          } else {
            this.network.sendCast(spellId, 0, 0);
          }
          return;
        }
      }

      if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
        this.cancelTargeting();
        if (this.meleeRange > 1) {
          this.enterTargeting({ mode: "attack", rangeTiles: this.meleeRange });
        } else {
          this.network.sendAttack();
        }
        return;
      }

      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
      if (this.meleeRange > 1) {
        this.enterTargeting({ mode: "attack", rangeTiles: this.meleeRange });
      } else {
        this.network.sendAttack();
      }
    }

    if (leftClicked) {
      const tile = getMouseTile();
      this.onInteract?.(tile.x, tile.y);
    }

    for (const { key, spellId, rangeTiles } of this.spellKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        if (rangeTiles > 0) {
          this.enterTargeting({ mode: "spell", spellId, rangeTiles });
        } else {
          this.network.sendCast(spellId, 0, 0);
        }
      }
    }
  }

  setSpeed(tilesPerSecond: number) {
    const speed = tilesPerSecond || 0.1;
    this.moveIntervalMs = 1000 / speed;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onPointerDown);
    const kb = this.scene.input.keyboard;
    if (kb) {
      for (const key of Object.values(this.moveKeys)) kb.removeKey(key);
      kb.removeKey(this.ctrlKey);
      kb.removeKey(this.escKey);
      kb.removeKey(this.pttKey);
      for (const { key } of this.spellKeys) kb.removeKey(key);
    }
  }
}
