import { ABILITIES, CLASS_STATS, Direction } from "@abraxas/shared";
import Phaser from "phaser";
import type { NetworkManager } from "../network/NetworkManager";

const KEY_TO_DIRECTION: Record<number, Direction> = {
  [Phaser.Input.Keyboard.KeyCodes.UP]: Direction.UP,
  [Phaser.Input.Keyboard.KeyCodes.DOWN]: Direction.DOWN,
  [Phaser.Input.Keyboard.KeyCodes.LEFT]: Direction.LEFT,
  [Phaser.Input.Keyboard.KeyCodes.RIGHT]: Direction.RIGHT,
};

type TargetingState =
  | { mode: "spell"; spellId: string; rangeTiles: number }
  | { mode: "attack"; rangeTiles: number };

export class InputHandler {
  private scene: Phaser.Scene;
  private network: NetworkManager;
  private attackRange: number;
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
  private onRightClickTile?: (
    tileX: number,
    tileY: number,
    screenX: number,
    screenY: number,
  ) => void;
  private onPttStart?: () => void;
  private onPttEnd?: () => void;
  private onTargetingCancelled?: () => void;
  private pttKey!: Phaser.Input.Keyboard.Key;

  targeting: TargetingState | null = null;

  private pendingLeftClick = false;
  private pendingRightClick = false;

  private lastRightClickScreenX = 0;
  private lastRightClickScreenY = 0;

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.leftButtonDown()) this.pendingLeftClick = true;
    if (pointer.rightButtonDown()) {
      this.pendingRightClick = true;
      this.lastRightClickScreenX = pointer.x;
      this.lastRightClickScreenY = pointer.y;
    }
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
    onRightClickTile?: (tileX: number, tileY: number, screenX: number, screenY: number) => void,
    onTargetingCancelled?: () => void,
  ) {
    this.scene = scene;
    this.network = network;
    this.onLocalMove = onLocalMove;
    this.onEnterTargeting = onEnterTargeting;
    this.onExitTargeting = onExitTargeting;
    this.onInteract = onInteract;
    this.onPttStart = onPttStart;
    this.onPttEnd = onPttEnd;
    this.onRightClickTile = onRightClickTile;
    this.onTargetingCancelled = onTargetingCancelled;

    const stats = CLASS_STATS[classType];
    const speed = stats.speedTilesPerSecond;
    this.moveIntervalMs = 1000 / speed;
    this.attackRange = stats.attackRange;

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

      for (const abilityId of stats.abilities) {
        const ability = ABILITIES[abilityId];
        if (!ability?.key) continue;
        const keyCodes = Object.entries(Phaser.Input.Keyboard.KeyCodes);
        const match = keyCodes.find(([k]) => k === ability.key);
        const keyCode = match ? match[1] : undefined;
        if (typeof keyCode === "number") {
          this.spellKeys.push({
            key: scene.input.keyboard.addKey(keyCode),
            spellId: ability.id,
            rangeTiles: ability.rangeTiles,
          });
        }
      }
    }
  }

  enterTargeting(state: TargetingState) {
    this.targeting = state;
    this.onEnterTargeting?.(state.rangeTiles);
  }

  cancelTargeting() {
    if (this.targeting) {
      this.targeting = null;
      this.onExitTargeting?.();
    }
  }

  update(time: number, getMouseTile: () => { x: number; y: number }, canAct: boolean = true) {
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

    if (!canAct) {
      if (this.targeting) {
        this.cancelTargeting();
        this.onTargetingCancelled?.();
      }
      if (rightClicked) {
        const tile = getMouseTile();
        this.onRightClickTile?.(
          tile.x,
          tile.y,
          this.lastRightClickScreenX,
          this.lastRightClickScreenY,
        );
      }
      return;
    }

    for (const key of Object.values(this.moveKeys)) {
      if (key.isDown) {
        if (time - this.lastMoveSentMs >= this.moveIntervalMs) {
          const direction = KEY_TO_DIRECTION[key.keyCode];
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
          this.handleSpellKey(spellId, rangeTiles);
          return;
        }
      }

      if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
        this.cancelTargeting();
        this.handleAttackInput();
        return;
      }

      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.ctrlKey)) {
      this.handleAttackInput();
    }

    if (leftClicked) {
      const tile = getMouseTile();
      this.onInteract?.(tile.x, tile.y);
    }

    if (rightClicked) {
      const tile = getMouseTile();
      this.onRightClickTile?.(
        tile.x,
        tile.y,
        this.lastRightClickScreenX,
        this.lastRightClickScreenY,
      );
    }

    for (const { key, spellId, rangeTiles } of this.spellKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.handleSpellKey(spellId, rangeTiles);
      }
    }
  }

  private handleSpellKey(spellId: string, rangeTiles: number) {
    if (rangeTiles > 0) {
      this.enterTargeting({ mode: "spell", spellId, rangeTiles });
    } else {
      this.network.sendCast(spellId, 0, 0);
    }
  }

  handleAttackInput() {
    if (this.attackRange > 1) {
      this.enterTargeting({ mode: "attack", rangeTiles: this.attackRange });
    } else {
      this.network.sendAttack();
    }
  }

  triggerMove(direction: Direction, time: number) {
    if (time - this.lastMoveSentMs >= this.moveIntervalMs) {
      this.network.sendMove(direction);
      this.onLocalMove?.(direction);
      this.lastMoveSentMs += this.moveIntervalMs;
      if (time - this.lastMoveSentMs > this.moveIntervalMs) this.lastMoveSentMs = time;
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
