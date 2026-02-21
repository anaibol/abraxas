import type { ServerMessages } from "@abraxas/shared";
import {
  ABILITIES,
  ChatChannel,
  i18n,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
  TILE_SIZE,
} from "@abraxas/shared";
import type { Room } from "@colyseus/sdk";
import { HEAVY_HIT_ABILITIES, type SoundManager } from "../assets/SoundManager";
import { LightPreset, type LightManager } from "../managers/LightManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SpriteManager } from "../managers/SpriteManager";
import type { ConsoleCallback } from "../scenes/GameScene";
import type { InputHandler } from "../systems/InputHandler";
import { gameSettings } from "../settings/gameSettings";

// ── Lookup tables ─────────────────────────────────────────────────────────────
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

export class GameEventHandler {
  private unsubscribers: (() => void)[] = [];

  private lastShakeTime = 0;
  private readonly SHAKE_COOLDOWN_MS = 200;

  constructor(
    private room: Room,
    private spriteManager: SpriteManager,
    private effectManager: EffectManager,
    private soundManager: SoundManager,
    private inputHandler: InputHandler,
    private onConsoleMessage?: ConsoleCallback,
    private onKillFeed?: (killer: string, victim: string) => void,
    private onCameraShake?: (intensity: number, durationMs: number) => void,
    private onCameraFlash?: (r: number, g: number, b: number, durationMs: number) => void,
    private onCameraZoom?: (zoom: number, durationMs: number) => void,
    private onHitStop?: (durationMs: number) => void,
    private lightManager?: LightManager,
  ) {}

  private addCooldown?: (abilityId: string, durationMs: number) => void;

  public setCooldownCallback(cb: (abilityId: string, durationMs: number) => void) {
    this.addCooldown = cb;
  }

  private maybeShake(intensity: number, durationMs: number) {
    const s = gameSettings.get();
    if (!s.screenShakeEnabled) return;
    this.onCameraShake?.(intensity * s.screenShakeIntensity, durationMs);
  }

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
    on(ServerMessageType.LevelUp, (data) => this.onLevelUp(data));
    on(ServerMessageType.BuffApplied, (data) => this.onBuffApplied(data));
    on(ServerMessageType.StunApplied, (data) => this.onStunApplied(data));
    on(ServerMessageType.Respawn, (data) => this.onRespawn(data));
    on(ServerMessageType.KillFeed, (data) => this.onKillFeedMessage(data));
    on(ServerMessageType.InvalidTarget, (data) => this.onInvalidTarget(data));
    on(ServerMessageType.StealthApplied, (data) => this.onStealthApplied(data));
    on(ServerMessageType.NpcBark, (data) => this.onNpcBark(data));
    on(ServerMessageType.WorldEventStart, (data) => this.onWorldEventStart(data));
    on(ServerMessageType.WorldEventEnd, (data) => this.onWorldEventEnd(data));
    on(ServerMessageType.WorldEventProgress, (data) => this.onWorldEventProgress(data));
    on(ServerMessageType.FastTravelUsed, (data) => this.onFastTravelUsed(data));
    on(ServerMessageType.OpenDialogue, (data) => this.onOpenDialogue(data));
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

    let isRanged = false;
    if (data.targetTileX !== undefined && data.targetTileY !== undefined) {
      if (sprite) {
        const casterTileX = Math.round(sprite.renderX / TILE_SIZE);
        const casterTileY = Math.round(sprite.renderY / TILE_SIZE);
        const dx = data.targetTileX - casterTileX;
        const dy = data.targetTileY - casterTileY;
        if (Math.sqrt(dx * dx + dy * dy) >= 1.5) isRanged = true;
      }
      this.effectManager.maybeLaunchAttackProjectile(
        data.sessionId,
        data.targetTileX,
        data.targetTileY,
      );
    }

    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    if (isRanged) {
      this.soundManager.playBow(opts);
    } else {
      const npc = this.room.state.npcs.get(data.sessionId);
      if (npc) {
        this.soundManager.playNpcAttack(npc.npcType, opts);
      } else {
        const player = this.room.state.players.get(data.sessionId);
        this.soundManager.playAttack(player?.equipWeaponId ?? undefined, opts);
      }
    }
  }

  private onAttackHit(data: ServerMessages["attack_hit"]) {
    if (data.targetSessionId) {
      if (data.dodged || data.parried) {
        this.effectManager.showDamage(data.targetSessionId, 0, data.dodged ? "dodged" : "parried");
      } else {
        this.spriteManager.flashSprite(data.targetSessionId);
        this.effectManager.playMeleeHit(data.targetSessionId);
      }
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
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    this.soundManager.playSpellSfx(data.abilityId, opts);
    this.effectManager.maybeLaunchProjectile(
      data.sessionId,
      data.abilityId,
      data.targetTileX,
      data.targetTileY,
    );

    if (this.isSelf(data.sessionId) && this.addCooldown) {
      const ability = ABILITIES[data.abilityId];
      if (ability && ability.cooldownMs) {
        this.addCooldown(data.abilityId, ability.cooldownMs);
      }
    }
  }

  private onCastHit(data: ServerMessages["cast_hit"]) {
    this.effectManager.playSpellEffect(data.abilityId, data.targetTileX, data.targetTileY, data.sessionId);

    const sourceX = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const sourceY = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;
    this.soundManager.playSpellImpactSfx(data.abilityId, { sourceX, sourceY });

    const isHeavy = HEAVY_HIT_ABILITIES.has(data.abilityId);
    const now = Date.now();
    if (isHeavy && now - this.lastShakeTime > this.SHAKE_COOLDOWN_MS) {
      this.lastShakeTime = now;
      this.maybeShake(0.0025, 140);
    }

    if (this.lightManager) {
      const px = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
      const py = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;
      const preset = this.spellLightPreset(data.abilityId);
      if (preset) this.lightManager.flashLight(px, py, preset.preset, undefined, preset.durationMs);
    }
  }

  private onDamage(data: ServerMessages["damage"]) {
    if (data.dodged || data.parried) {
      this.effectManager.showDamage(data.targetSessionId, 0, data.dodged ? "dodged" : "parried");
      return;
    }

    this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
    const sprite = this.spriteManager.getSprite(data.targetSessionId);
    if (sprite) {
      sprite.updateHpMana(data.hpAfter, 0);
    }
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;

    if (this.isSelf(data.targetSessionId)) {
      const now = Date.now();
      if (now - this.lastShakeTime > this.SHAKE_COOLDOWN_MS) {
        this.lastShakeTime = now;
        const intensity = Math.min(0.035, data.amount * 0.0001);
        if (intensity > 0.002) {
          this.maybeShake(intensity, 200);
          // Hard hits trigger a brief cinematic hit-stop
          if (intensity > 0.015) this.onHitStop?.(45);
          else if (intensity > 0.008) this.onHitStop?.(25);
        }
      }
      this.onCameraFlash?.(255, 60, 60, 150);
      this.soundManager.playHit(opts);
      this.onConsoleMessage?.(t("game.you_took_damage", { amount: data.amount }), "#ff4444", "combat");
    } else {
      this.soundManager.playHit(opts);
      if (data.attackerSessionId && this.isSelf(data.attackerSessionId)) {
        this.spriteManager.setTargetOutline(data.targetSessionId);
        this.onConsoleMessage?.(t("game.you_dealt_damage", { amount: data.amount }), "#ff8800", "combat");
      }
    }
  }

  private onDeath(data: ServerMessages["death"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.effectManager.playDeath(data.sessionId);
      this.spriteManager.playDeathAnimation(data.sessionId);
      this.spriteManager.setAlpha(data.sessionId, 0.3);
      this.spriteManager.clearGlowFx(data.sessionId);
      // Clear target if the dying entity was our target
      if (this.spriteManager.currentTargetId === data.sessionId) {
        this.spriteManager.setTargetOutline(null);
      }
    }
    if (this.isSelf(data.sessionId)) {
      this.inputHandler.cancelTargeting();
      this.onConsoleMessage?.(t("game.you_died"), "#ff0000", "combat");
      this.maybeShake(0.018, 800);
      this.onCameraFlash?.(0, 0, 0, 1500);
    }
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    this.soundManager.playDeath(opts);
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
      this.onCameraZoom?.(1.12, 500);
    }
  }

  private onHeal(data: ServerMessages["heal"]) {
    this.effectManager.showHeal(data.sessionId, data.amount);
    const sprite = this.spriteManager.getSprite(data.sessionId);
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    this.soundManager.playHeal(opts);

    if (this.lightManager && sprite) {
      this.lightManager.flashLight(sprite.renderX, sprite.renderY, LightPreset.HEAL, undefined, 700);
    }
    this.spriteManager.applyGlowFx(data.sessionId, 0xaaffaa, 500);

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
      this.spriteManager.applyGlowFx(data.sessionId, 0xcc44ff, durationMs);
    } else if (effect === "stun") {
      this.spriteManager.applyStunVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_stunned")} ✦`, "#ffff44");
      this.spriteManager.applyGlowFx(data.sessionId, 0xffdd44, durationMs);
    } else if (effect === "stealth") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_stealth"), "#aaddff");
      if (this.isSelf(data.sessionId)) {
        this.lightManager?.setPlayerLightColor(0x4466aa, 0.15);
        window.setTimeout(() => this.lightManager?.resetPlayerLightColor(), durationMs);
      }
    } else if (data.abilityId === "divine_shield") {
      this.spriteManager.applyInvulnerableVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_invulnerable"), "#ffffff");
      this.spriteManager.applyGlowFx(data.sessionId, 0xffffff, durationMs);
    } else if (effect === "dot") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_poisoned"), "#44ff44");
      this.spriteManager.applyGlowFx(data.sessionId, 0x44ff44, durationMs);
    } else {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_buffed")} ✦`, "#ffdd44");
      this.spriteManager.applyGlowFx(data.sessionId, this.buffGlowColor(data.abilityId), durationMs);
      if (this.isSelf(data.sessionId)) {
        const playerLightColor = this.buffPlayerLightColor(data.abilityId);
        if (playerLightColor !== null) {
          this.lightManager?.setPlayerLightColor(playerLightColor, 1.4);
          window.setTimeout(() => this.lightManager?.resetPlayerLightColor(), durationMs);
        }
      }
    }
  }

  private onStunApplied(data: ServerMessages["stun_applied"]) {
    this.spriteManager.applyStunVisual(data.targetSessionId, data.durationMs ?? 1500);
    this.effectManager.showFloatingText(data.targetSessionId, `${t("game.buff_stunned")} ✦`, "#ffff44");
    this.spriteManager.applyGlowFx(data.targetSessionId, 0xffdd44, data.durationMs ?? 1500);
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

  private onInvalidTarget(data?: ServerMessages["invalid_target"]) {
    const msg = data?.reason ? t(`game.invalid_target_${data.reason}`) : t("game.invalid_target");
    this.effectManager.showFloatingText(this.room.sessionId, msg, "#ff8800");
  }

  private onLevelUp(data: ServerMessages["level_up"]) {
    this.effectManager.playLevelUp(data.sessionId);
    const sprite = this.spriteManager.getSprite(data.sessionId);
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    if (this.isSelf(data.sessionId)) {
      this.soundManager.playLevelUp(opts);
      this.onCameraZoom?.(1.06, 300);
    } else {
      this.soundManager.playNpcLevelUp(opts);
    }
  }

  private onNpcBark(data: ServerMessages[ServerMessageType.NpcBark]) {
    this.spriteManager.showChatBubble(data.npcId, data.text);
  }

  private onWorldEventStart(data: ServerMessages[ServerMessageType.WorldEventStart]) {
    const mins = Math.round(data.durationMs / 60_000);
    this.onConsoleMessage?.(
      `⚔ World Event: ${data.name} — ${data.description} (${mins}m)`,
      "#ffcc44",
      "system",
    );
    this.onCameraFlash?.(255, 180, 0, 400);
  }

  private onWorldEventEnd(_data: ServerMessages[ServerMessageType.WorldEventEnd]) {
    this.onConsoleMessage?.("✓ World Event ended.", "#aaffaa", "system");
  }

  private onWorldEventProgress(data: ServerMessages[ServerMessageType.WorldEventProgress]) {
    const pct = Math.round((data.npcsDead / data.npcsTotalCount) * 100);
    this.onConsoleMessage?.(
      `⚔ Event progress: ${data.npcsDead}/${data.npcsTotalCount} (${pct}%)`,
      "#ffcc44",
      "system",
    );
  }

  private onFastTravelUsed(_data: ServerMessages[ServerMessageType.FastTravelUsed]) {
    this.onCameraFlash?.(200, 255, 255, 400);
    this.onConsoleMessage?.("✈ Fast travel used.", "#88ddff", "system");
  }

  private onOpenDialogue(data: ServerMessages[ServerMessageType.OpenDialogue]) {
    this.spriteManager.showChatBubble(data.npcId, t(data.text));
  }

  // ── Lookup tables ─────────────────────────────────────────────────────────────
  private readonly SPELL_LIGHT_MAP = new Map<string, { preset: LightPreset; durationMs: number }>([
    ["fireball",          { preset: LightPreset.EXPLOSION, durationMs: 400 }],
    ["meteor_strike",     { preset: LightPreset.EXPLOSION, durationMs: 400 }],
    ["fire_breath",       { preset: LightPreset.EXPLOSION, durationMs: 400 }],
    ["war_cry",           { preset: LightPreset.EXPLOSION, durationMs: 400 }],
    ["execute",           { preset: LightPreset.EXPLOSION, durationMs: 400 }],
    ["ice_bolt",          { preset: LightPreset.FROST,     durationMs: 600 }],
    ["frost_nova",        { preset: LightPreset.FROST,     durationMs: 600 }],
    ["frost_breath",      { preset: LightPreset.FROST,     durationMs: 600 }],
    ["polymorph",         { preset: LightPreset.FROST,     durationMs: 600 }],
    ["holy_nova",         { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["judgment",          { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["consecration",      { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["smite",             { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["holy_bolt",         { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["holy_strike",       { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["lay_on_hands",      { preset: LightPreset.HOLY,      durationMs: 500 }],
    ["thunderstorm",      { preset: LightPreset.ELECTRIC,  durationMs: 350 }],
    ["chain_lightning",   { preset: LightPreset.ELECTRIC,  durationMs: 350 }],
    ["leap",              { preset: LightPreset.ELECTRIC,  durationMs: 350 }],
    ["whirlwind",         { preset: LightPreset.ELECTRIC,  durationMs: 350 }],
    ["shadow_bolt",       { preset: LightPreset.SHADOW,    durationMs: 500 }],
    ["soul_drain",        { preset: LightPreset.SHADOW,    durationMs: 500 }],
    ["banshee_wail",      { preset: LightPreset.SHADOW,    durationMs: 500 }],
    ["curse",             { preset: LightPreset.SHADOW,    durationMs: 500 }],
    ["heal",              { preset: LightPreset.HEAL,      durationMs: 700 }],
    ["cleansing_rain",    { preset: LightPreset.HEAL,      durationMs: 700 }],
    ["entangling_roots",  { preset: LightPreset.HEAL,      durationMs: 700 }],
    ["poison_arrow",      { preset: LightPreset.HEAL,      durationMs: 700 }],
    ["acid_splash",       { preset: LightPreset.HEAL,      durationMs: 700 }],
  ]);

  private spellLightPreset(abilityId: string) {
    return this.SPELL_LIGHT_MAP.get(abilityId) ?? null;
  }

  private buffGlowColor(abilityId: string): number {
    const map: Record<string, number> = {
      berserker_rage:     0xff3300,
      battle_shout:       0xff8800,
      shield_wall:        0x88aacc,
      mana_shield:        0x4488ff,
      evasion:            0x44ff88,
      aura_of_protection: 0xffe066,
      eagle_eye:          0x88ff44,
      pet_bond:           0x22dd88,
      spell_echo:         0xcc44ff,
      elemental_infusion: 0xff6644,
    };
    return map[abilityId] ?? 0xffdd44;
  }

  private buffPlayerLightColor(abilityId: string): number | null {
    const map: Record<string, number> = {
      berserker_rage:     0xff3300,
      mana_shield:        0x4488ff,
      divine_shield:      0xffe066,
      aura_of_protection: 0xffe066,
      elemental_infusion: 0xff6644,
      spell_echo:         0xcc44ff,
    };
    return map[abilityId] ?? null;
  }
}
