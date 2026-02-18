import type { Room } from "colyseus.js";
import type { ServerMessages } from "@abraxas/shared";
import { ServerMessageType } from "@abraxas/shared";
import type { SpriteManager } from "../managers/SpriteManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SoundManager } from "../assets/SoundManager";
import type { InputHandler } from "../systems/InputHandler";
import type { ConsoleCallback } from "../scenes/GameScene";

export class GameEventHandler {
  constructor(
    private room: Room,
    private spriteManager: SpriteManager,
    private effectManager: EffectManager,
    private soundManager: SoundManager,
    private inputHandler: InputHandler,
    private onConsoleMessage?: ConsoleCallback,
    private onKillFeed?: (killer: string, victim: string) => void,
    private onError?: (message: string) => void,
  ) {}

  private isSelf(sessionId: string): boolean {
    return sessionId === this.room.sessionId;
  }

  setupListeners() {
    this.room.onMessage(
      ServerMessageType.AttackStart,
      (data: ServerMessages["attack_start"]) => this.onAttackStart(data),
    );
    this.room.onMessage(
      ServerMessageType.AttackHit,
      (data: ServerMessages["attack_hit"]) => this.onAttackHit(data),
    );
    this.room.onMessage(
      ServerMessageType.CastStart,
      (data: ServerMessages["cast_start"]) => this.onCastStart(data),
    );
    this.room.onMessage(
      ServerMessageType.CastHit,
      (data: ServerMessages["cast_hit"]) => this.onCastHit(data),
    );
    this.room.onMessage(
      ServerMessageType.Damage,
      (data: ServerMessages["damage"]) => this.onDamage(data),
    );
    this.room.onMessage(
      ServerMessageType.Death,
      (data: ServerMessages["death"]) => this.onDeath(data),
    );
    this.room.onMessage(
      ServerMessageType.Heal,
      (data: ServerMessages["heal"]) => this.onHeal(data),
    );
    this.room.onMessage(
      ServerMessageType.BuffApplied,
      (data: ServerMessages["buff_applied"]) => this.onBuffApplied(data),
    );
    this.room.onMessage(
      ServerMessageType.StunApplied,
      (data: ServerMessages["stun_applied"]) => this.onStunApplied(data),
    );
    this.room.onMessage(
      ServerMessageType.Respawn,
      (data: ServerMessages["respawn"]) => this.onRespawn(data),
    );
    this.room.onMessage(
      ServerMessageType.KillFeed,
      (data: ServerMessages["kill_feed"]) => this.onKillFeedMessage(data),
    );
    this.room.onMessage(ServerMessageType.InvalidTarget, () =>
      this.onInvalidTarget(),
    );
    this.room.onMessage(
      ServerMessageType.LevelUp,
      (data: ServerMessages["level_up"]) => this.onLevelUp(data),
    );
    this.room.onMessage(
      ServerMessageType.Notification,
      (data: ServerMessages["notification"]) => this.onNotification(data),
    );
    this.room.onMessage(
      ServerMessageType.StealthApplied,
      (data: ServerMessages["stealth_applied"]) => this.onStealthApplied(data),
    );
    this.room.onMessage(ServerMessageType.Error, (data: { message: string }) =>
      this.onErrorMessage(data),
    );
  }

  private onErrorMessage(data: { message: string }) {
    this.onError?.(data.message);
    this.onConsoleMessage?.(`Error: ${data.message}`, "#ff0000");
  }

  private onAttackStart(data: ServerMessages["attack_start"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.pulseAlpha(data.sessionId, 0.7, 100);
      if (this.isSelf(data.sessionId))
        this.onConsoleMessage?.("You attacked!", "#cccccc");
    }
    this.soundManager.playAttack();
  }

  private onAttackHit(data: ServerMessages["attack_hit"]) {
    if (data.targetSessionId) {
      this.spriteManager.flashSprite(data.targetSessionId, 0xff0000);
    }
  }

  private onCastStart(data: ServerMessages["cast_start"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.pulseAlpha(data.sessionId, 0.8, 140);
      if (this.isSelf(data.sessionId))
        this.onConsoleMessage?.("You cast a spell!", "#aaaaff");
    }
    this.soundManager.playSpell();
  }

  private onCastHit(data: ServerMessages["cast_hit"]) {
    this.effectManager.playEffect(
      data.fxId,
      data.targetTileX,
      data.targetTileY,
    );
  }

  private onDamage(data: ServerMessages["damage"]) {
    this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
    this.soundManager.playHit();

    if (this.isSelf(data.targetSessionId)) {
      this.onConsoleMessage?.(`You took ${data.amount} damage!`, "#ff4444");
    }
  }

  private onDeath(data: ServerMessages["death"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.setAlpha(data.sessionId, 0.3);
    }
    if (this.isSelf(data.sessionId)) {
      this.inputHandler.cancelTargeting();
      this.onConsoleMessage?.("You have died!", "#ff0000");
    }
    this.soundManager.playDeath();
  }

  private onRespawn(data: ServerMessages["respawn"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.setAlpha(data.sessionId, 1);
      sprite.setTilePosition(data.tileX, data.tileY);
    }
    if (this.isSelf(data.sessionId)) {
      this.onConsoleMessage?.("You have respawned!", "#ffffff");
    }
  }

  private onHeal(data: ServerMessages["heal"]) {
    this.effectManager.showHeal(data.sessionId, data.amount);
    this.soundManager.playHeal();
    if (this.isSelf(data.sessionId)) {
      this.onConsoleMessage?.(`You healed for ${data.amount}!`, "#33cc33");
    }
  }

  private onBuffApplied(data: ServerMessages["buff_applied"]) {
    this.effectManager.showFloatingText(data.sessionId, "BUFF", "#d4a843");
  }

  private onStunApplied(data: ServerMessages["stun_applied"]) {
    this.effectManager.showFloatingText(
      data.targetSessionId,
      "STUNNED",
      "#cccc33",
    );
    if (this.isSelf(data.targetSessionId)) {
      this.onConsoleMessage?.("You are stunned!", "#cccc33");
    }
  }

  private onStealthApplied(data: ServerMessages["stealth_applied"]) {
    this.effectManager.showFloatingText(data.sessionId, "STEALTH", "#aaddff");
  }

  private onKillFeedMessage(data: ServerMessages["kill_feed"]) {
    this.onKillFeed?.(data.killerName, data.victimName);
  }

  private onInvalidTarget() {
    this.effectManager.showNotification(
      this.room.sessionId,
      "Invalid target",
      "#ff8800",
    );
  }

  private onLevelUp(data: ServerMessages["level_up"]) {
    this.effectManager.showFloatingText(data.sessionId, "LEVEL UP!", "#ffff00");
  }

  private onNotification(data: ServerMessages["notification"]) {
    this.onConsoleMessage?.(data.message, "#ffff00");
  }
}
