import type { ServerMessages } from "@abraxas/shared";
import {
  ABILITIES,
  ChatChannel,
  i18n,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
} from "@abraxas/shared";
import type { Room } from "@colyseus/sdk";
import type { SoundManager } from "../assets/SoundManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SpriteManager } from "../managers/SpriteManager";
import type { ConsoleCallback } from "../scenes/GameScene";
import type { InputHandler } from "../systems/InputHandler";

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

export class GameEventHandler {
  private unsubscribers: (() => void)[] = [];

  constructor(
    private room: Room,
    private spriteManager: SpriteManager,
    private effectManager: EffectManager,
    private soundManager: SoundManager,
    private inputHandler: InputHandler,
    private onConsoleMessage?: ConsoleCallback,
    private onKillFeed?: (killer: string, victim: string) => void,
  ) {}

  private isSelf(sessionId: string): boolean {
    return sessionId === this.room.sessionId;
  }

  setupListeners() {
    const on = <T extends keyof ServerMessages>(
      type: T,
      handler: (data: ServerMessages[T]) => void,
    ) => {
      this.unsubscribers.push(this.room.onMessage(type, handler));
    };

    on(ServerMessageType.Chat, (data) => this.onChat(data));
    on(ServerMessageType.AttackStart, (data) => this.onAttackStart(data));
    on(ServerMessageType.AttackHit, (data) => this.onAttackHit(data));
    on(ServerMessageType.CastStart, (data) => this.onCastStart(data));
    on(ServerMessageType.CastHit, (data) => this.onCastHit(data));
    on(ServerMessageType.Damage, (data) => this.onDamage(data));
    on(ServerMessageType.Death, (data) => this.onDeath(data));
    on(ServerMessageType.Heal, (data) => this.onHeal(data));
    on(ServerMessageType.BuffApplied, (data) => this.onBuffApplied(data));
    on(ServerMessageType.StunApplied, (data) => this.onStunApplied(data));
    on(ServerMessageType.Respawn, (data) => this.onRespawn(data));
    on(ServerMessageType.KillFeed, (data) => this.onKillFeedMessage(data));
    on(ServerMessageType.InvalidTarget, () => this.onInvalidTarget());
    on(ServerMessageType.LevelUp, (data) => this.onLevelUp(data));
    on(ServerMessageType.StealthApplied, (data) => this.onStealthApplied(data));
    // Notification and Error are handled (with translation) in useRoomListeners
  }

  destroy() {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  private onChat(data: ServerMessages[ServerMessageType.Chat]) {
    if (data.channel === ChatChannel.Whisper || data.channel === ChatChannel.System) {
      if (data.channel === ChatChannel.Whisper && !this.isSelf(data.senderId)) {
        this.soundManager.playNotification();
      }
      return;
    }
    this.spriteManager.showChatBubble(data.senderId, data.message);
  }

  private onAttackStart(data: ServerMessages["attack_start"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.pulseAlpha(data.sessionId, 0.7, 100);
      if (this.isSelf(data.sessionId))
        this.onConsoleMessage?.(t("game.you_attacked"), "#cccccc", "combat");
    }
    this.soundManager.playAttack();

    if (data.targetTileX !== undefined && data.targetTileY !== undefined) {
      this.effectManager.maybeLaunchAttackProjectile(
        data.sessionId,
        data.targetTileX,
        data.targetTileY,
      );
    }
  }

  private onAttackHit(data: ServerMessages["attack_hit"]) {
    if (data.targetSessionId) {
      this.spriteManager.flashSprite(data.targetSessionId);
      this.effectManager.playMeleeHit(data.targetSessionId);
    }
  }

  private onCastStart(data: ServerMessages["cast_start"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.spriteManager.pulseAlpha(data.sessionId, 0.8, 140);
      this.effectManager.playCastWindup(data.sessionId, data.abilityId);
      if (this.isSelf(data.sessionId))
        this.onConsoleMessage?.(t("game.you_cast_spell"), "#aaaaff", "combat");
    }
    
    const ability = ABILITIES[data.abilityId];
    if (ability) {
      if (ability.effect === "heal" || ability.effect === "aoe_heal" || ability.effect === "cleanse") {
        this.soundManager.playHeal();
      } else if (ability.effect === "buff") {
        this.soundManager.playBuff();
      } else if (ability.effect === "stealth") {
        this.soundManager.playStealth();
      } else if (ability.effect === "summon") {
        this.soundManager.playSummon();
      } else {
        this.soundManager.playSpell();
      }
    } else {
      this.soundManager.playSpell();
    }

    this.effectManager.maybeLaunchProjectile(
      data.sessionId,
      data.abilityId,
      data.targetTileX,
      data.targetTileY,
    );
  }

  private onCastHit(data: ServerMessages["cast_hit"]) {
    this.effectManager.playSpellEffect(data.abilityId, data.targetTileX, data.targetTileY, data.sessionId);
    
    const ability = ABILITIES[data.abilityId];
    if (ability && ability.damageSchool === "magical" && (ability.effect === "damage" || ability.effect === "aoe" || ability.effect === "debuff" || ability.effect === "leech")) {
      this.soundManager.playMagicHit();
    }
  }

  private onDamage(data: ServerMessages["damage"]) {
    this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
    this.soundManager.playHit();

    if (this.isSelf(data.targetSessionId)) {
      this.onConsoleMessage?.(
        t("game.you_took_damage", { amount: data.amount }),
        "#ff4444",
        "combat",
      );
    }
  }

  private onDeath(data: ServerMessages["death"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.effectManager.playDeath(data.sessionId);
      this.spriteManager.playDeathAnimation(data.sessionId);
      this.spriteManager.setAlpha(data.sessionId, 0.3);
    }
    if (this.isSelf(data.sessionId)) {
      this.inputHandler.cancelTargeting();
      this.onConsoleMessage?.(t("game.you_died"), "#ff0000", "combat");
    }
    this.soundManager.playDeath();
  }

  private onRespawn(data: ServerMessages["respawn"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      sprite.setTilePosition(data.tileX, data.tileY);
      this.effectManager.playRespawn(data.sessionId);
      this.spriteManager.startSpawnProtectionEffect(data.sessionId, SPAWN_PROTECTION_MS);
    }
    if (this.isSelf(data.sessionId)) {
      this.onConsoleMessage?.(t("game.you_respawned"), "#aaffaa", "combat");
    }
  }

  private onHeal(data: ServerMessages["heal"]) {
    this.effectManager.showHeal(data.sessionId, data.amount);
    this.soundManager.playHeal();
    if (this.isSelf(data.sessionId)) {
      this.onConsoleMessage?.(t("game.you_healed", { amount: data.amount }), "#33cc33", "combat");
    }
  }

  private onBuffApplied(data: ServerMessages["buff_applied"]) {
    const ability = ABILITIES[data.abilityId];
    const durationMs = data.durationMs;
    const effect = ability?.effect ?? "buff";

    if (effect === "debuff") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_weakened"), "#cc44ff");
    } else if (effect === "stun") {
      this.spriteManager.applyStunVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_stunned")} ✦`, "#ffff44");
    } else if (effect === "stealth") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_stealth"), "#aaddff");
    } else if (data.abilityId === "divine_shield") {
      this.spriteManager.applyInvulnerableVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_invulnerable"), "#ffffff");
    } else if (effect === "dot") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_poisoned"), "#44ff44");
    } else {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_buffed")} ✦`, "#ffdd44");
    }
  }

  private onStunApplied(data: ServerMessages["stun_applied"]) {
    this.spriteManager.applyStunVisual(data.targetSessionId, data.durationMs ?? 1500);
    this.effectManager.showFloatingText(
      data.targetSessionId,
      `${t("game.buff_stunned")} ✦`,
      "#ffff44",
    );
    if (this.isSelf(data.targetSessionId)) {
      this.onConsoleMessage?.(t("game.you_stunned"), "#ffff44", "combat");
    }
  }

  private onStealthApplied(data: ServerMessages["stealth_applied"]) {
    this.spriteManager.applySpellStateVisual(data.sessionId, "stealth", data.durationMs);
    this.effectManager.showFloatingText(data.sessionId, t("game.buff_stealth"), "#aaddff");
  }

  private onKillFeedMessage(data: ServerMessages["kill_feed"]) {
    this.onKillFeed?.(data.killerName, data.victimName);
  }

  private onInvalidTarget() {
    this.effectManager.showFloatingText(this.room.sessionId, t("game.invalid_target"), "#ff8800");
  }

  private onLevelUp(data: ServerMessages["level_up"]) {
    this.effectManager.playLevelUp(data.sessionId);
    if (this.isSelf(data.sessionId)) {
      this.soundManager.playLevelUp();
    }
  }
}
