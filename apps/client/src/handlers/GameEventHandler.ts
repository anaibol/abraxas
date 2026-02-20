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
import { HEAVY_HIT_ABILITIES, SPELL_IMPACT_SFX, type SoundManager } from "../assets/SoundManager";
import { LightPreset, type LightManager } from "../managers/LightManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SpriteManager } from "../managers/SpriteManager";
import type { ConsoleCallback } from "../scenes/GameScene";
import type { InputHandler } from "../systems/InputHandler";
import { gameSettings } from "../settings/gameSettings";

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

export class GameEventHandler {
  private unsubscribers: (() => void)[] = [];

  // ── Item #16: Per-source shake cooldown ─────────────────────────────────────
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
    /** Camera shake callback — heavy-impact spells call this. */
    private onCameraShake?: (intensity: number, durationMs: number) => void,
    /** Camera flash callback — used for damage screen flash (#13) and death (#14) */
    private onCameraFlash?: (r: number, g: number, b: number, durationMs: number) => void,
    /** Camera zoom callback — level-up pulse (#19), respawn zoom in (#17) */
    private onCameraZoom?: (zoom: number, durationMs: number) => void,
    private lightManager?: LightManager,
  ) {}

  /** Item 82: Gate shake calls through settings. */
  private maybeShake(intensity: number, durationMs: number) {
    const s = gameSettings.get();
    if (!s.screenShakeEnabled) return;
    this.onCameraShake?.(intensity * s.screenShakeIntensity, durationMs);
  }

  private isSelf(sessionId: string): boolean {
    return sessionId === this.room.sessionId;
  }

  private getLocalPlayerTile(): { tileX: number; tileY: number } | null {
    const lp = this.room.state.players.get(this.room.sessionId);
    if (!lp) return null;
    return { tileX: lp.tileX, tileY: lp.tileY };
  }

  /** Item #3/distance: Distance in tiles from local player to a tile position. */
  private distanceToLocal(tileX: number, tileY: number): number {
    const lp = this.getLocalPlayerTile();
    if (!lp) return 0;
    const dx = tileX - lp.tileX;
    const dy = tileY - lp.tileY;
    return Math.sqrt(dx * dx + dy * dy);
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
    on(ServerMessageType.InvalidTarget, () => this.onInvalidTarget());
    on(ServerMessageType.StealthApplied, (data) => this.onStealthApplied(data));

    // ── NPC Bark ──────────────────────────────────────────────────────────────
    on(ServerMessageType.NpcBark, (data) => this.onNpcBark(data));

    // ── World Events ─────────────────────────────────────────────────────────
    on(ServerMessageType.WorldEventStart, (data) => this.onWorldEventStart(data));
    on(ServerMessageType.WorldEventEnd, (data) => this.onWorldEventEnd(data));
    on(ServerMessageType.WorldEventProgress, (data) => this.onWorldEventProgress(data));

    // ── Fast Travel ──────────────────────────────────────────────────────────
    on(ServerMessageType.FastTravelUsed, (data) => this.onFastTravelUsed(data));
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

    if (isRanged) {
      const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
      this.soundManager.playBow(opts);
    } else {
      const npc = this.room.state.npcs.get(data.sessionId);
      const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
      if (npc) {
        this.soundManager.playNpcAttack(npc.npcType, opts);
      } else {
        // Item #6: Pass weapon id for weapon-type SFX routing
        const player = this.room.state.players.get(data.sessionId);
        this.soundManager.playAttack(player?.equipWeaponId ?? undefined, opts);
      }
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

    // Per-spell SFX on CAST (not impact)
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    this.soundManager.playSpellSfx(data.abilityId, opts);

    this.effectManager.maybeLaunchProjectile(
      data.sessionId,
      data.abilityId,
      data.targetTileX,
      data.targetTileY,
    );
  }

  private onCastHit(data: ServerMessages["cast_hit"]) {
    this.effectManager.playSpellEffect(data.abilityId, data.targetTileX, data.targetTileY, data.sessionId);

    // Item #9: Impact SFX separate from cast SFX
    const sourceX = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const sourceY = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;
    this.soundManager.playSpellImpactSfx(data.abilityId, { sourceX, sourceY });

    // ── Item #11 + #12: Camera shake scaled by proximity & self-target ─────────
    const isHeavy = HEAVY_HIT_ABILITIES.has(data.abilityId);
    const now = Date.now();

    if (isHeavy && now - this.lastShakeTime > this.SHAKE_COOLDOWN_MS) {
      this.lastShakeTime = now;
      this.maybeShake(0.009, 220); // item 82
    }

    // ── Item #35: Fire spells → lingering ember light ─────────────────────────
    // ── Item #36: Frost spells → icy ring light ───────────────────────────────
    // ── Item #37: Holy spells → radiating golden light ───────────────────────
    // ── Item #38: Shadow bolt → dark pulse ───────────────────────────────────
    if (this.lightManager) {
      const px = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
      const py = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;
      const preset = this.spellLightPreset(data.abilityId);
      if (preset !== null) {
        const { preset: p, durationMs } = preset;
        this.lightManager.flashLight(px, py, p, undefined, durationMs);
      }
    }
  }

  private onDamage(data: ServerMessages["damage"]) {
    this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
    const sprite = this.spriteManager.getSprite(data.targetSessionId);
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;

    if (this.isSelf(data.targetSessionId)) {
      // ── Item #11: Scale shake from damage amount ───────────────────────────
      const now = Date.now();
      if (now - this.lastShakeTime > this.SHAKE_COOLDOWN_MS) {
        this.lastShakeTime = now;
        const intensity = Math.min(0.015, data.amount * 0.00005);
        if (intensity > 0.002) this.maybeShake(intensity, 150); // item 82
      }

      // ── Item #13: Red flash screen on taking damage ────────────────────────
      this.onCameraFlash?.(255, 60, 60, 150);

      this.soundManager.playHit(opts);
      this.onConsoleMessage?.(
        t("game.you_took_damage", { amount: data.amount }),
        "#ff4444",
        "combat",
      );
    } else {
      this.soundManager.playHit(opts);
    }
  }

  private onDeath(data: ServerMessages["death"]) {
    const sprite = this.spriteManager.getSprite(data.sessionId);
    if (sprite) {
      this.effectManager.playDeath(data.sessionId);
      this.spriteManager.playDeathAnimation(data.sessionId);
      this.spriteManager.setAlpha(data.sessionId, 0.3);
      // ── Item #47: Death removes active glow ───────────────────────────────
      this.spriteManager.clearGlowFx(data.sessionId);
    }
    if (this.isSelf(data.sessionId)) {
      this.inputHandler.cancelTargeting();
      this.onConsoleMessage?.(t("game.you_died"), "#ff0000", "combat");
      // ── Item #14: Big shake + blackout on self-death ───────────────────────
      this.maybeShake(0.018, 800); // item 82
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
      // ── Item #17: Zoom-in on respawn ──────────────────────────────────────
      this.onCameraZoom?.(1.12, 500);
    }
  }

  private onHeal(data: ServerMessages["heal"]) {
    this.effectManager.showHeal(data.sessionId, data.amount);
    const sprite = this.spriteManager.getSprite(data.sessionId);
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    this.soundManager.playHeal(opts);

    // ── Item #37: Holy-gold flash light on heal ────────────────────────────────
    if (this.lightManager) {
      const sprite = this.spriteManager.getSprite(data.sessionId);
      if (sprite) {
        const px = sprite.renderX;
        const py = sprite.renderY;
        this.lightManager.flashLight(px, py, LightPreset.HEAL, undefined, 700);
      }
    }

    // ── Item #46: Brief golden-white glow on healing ──────────────────────────
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
      // ── Item #32: Dim player light on stealth ─────────────────────────────
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
      const buffColor = this.buffGlowColor(data.abilityId);
      this.spriteManager.applyGlowFx(data.sessionId, buffColor, durationMs);

      // ── Item #33: Berserker Rage → red player light ────────────────────────
      // ── Item #34: Mana Shield → blue player light ──────────────────────────
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
    this.effectManager.showFloatingText(
      data.targetSessionId,
      `${t("game.buff_stunned")} ✦`,
      "#ffff44",
    );
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

  private onInvalidTarget() {
    this.effectManager.showFloatingText(this.room.sessionId, t("game.invalid_target"), "#ff8800");
  }

  private onLevelUp(data: ServerMessages["level_up"]) {
    this.effectManager.playLevelUp(data.sessionId);
    const sprite = this.spriteManager.getSprite(data.sessionId);
    const opts = sprite ? { sourceX: sprite.renderX, sourceY: sprite.renderY } : undefined;
    if (this.isSelf(data.sessionId)) {
      this.soundManager.playLevelUp(opts);
      // ── Item #19: Zoom pulse on level-up ──────────────────────────────────
      this.onCameraZoom?.(1.06, 300);
    } else {
      // Companion / NPC levelled up — play a shorter, distinct sound
      this.soundManager.playNpcLevelUp(opts);
    }
  }

  // ── NPC Bark ─────────────────────────────────────────────────────────────────
  private onNpcBark(data: ServerMessages[ServerMessageType.NpcBark]) {
    // Render bark as a speech bubble floating above the NPC sprite (same API as player chat).
    this.spriteManager.showChatBubble(data.npcId, data.text);
  }

  // ── World Events ──────────────────────────────────────────────────────────────
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

  // ── Fast Travel ───────────────────────────────────────────────────────────────
  private onFastTravelUsed(_data: ServerMessages[ServerMessageType.FastTravelUsed]) {
    this.onCameraFlash?.(200, 255, 255, 400);
    this.onConsoleMessage?.("✈ Fast travel used.", "#88ddff", "system");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Flat ability→preset lookup for spell impact light flashes. */
  private readonly SPELL_LIGHT_MAP = new Map<string, { preset: LightPreset; durationMs: number }>([
    // Fire
    ...(["fireball", "meteor_strike", "fire_breath", "war_cry", "execute"]
        .map(id => [id, { preset: LightPreset.EXPLOSION, durationMs: 400 }] as const)),
    // Ice
    ...(["ice_bolt", "frost_nova", "frost_breath", "polymorph"]
        .map(id => [id, { preset: LightPreset.FROST, durationMs: 600 }] as const)),
    // Holy
    ...(["holy_nova", "judgment", "consecration", "smite", "holy_bolt", "holy_strike", "lay_on_hands"]
        .map(id => [id, { preset: LightPreset.HOLY, durationMs: 500 }] as const)),
    // Electric
    ...(["thunderstorm", "chain_lightning", "leap", "whirlwind"]
        .map(id => [id, { preset: LightPreset.ELECTRIC, durationMs: 350 }] as const)),
    // Shadow
    ...(["shadow_bolt", "soul_drain", "banshee_wail", "curse"]
        .map(id => [id, { preset: LightPreset.SHADOW, durationMs: 500 }] as const)),
    // Nature / Heal
    ...(["heal", "cleansing_rain", "entangling_roots", "poison_arrow", "acid_splash"]
        .map(id => [id, { preset: LightPreset.HEAL, durationMs: 700 }] as const)),
  ]);

  private spellLightPreset(abilityId: string) {
    return this.SPELL_LIGHT_MAP.get(abilityId) ?? null;
  }

  /** Returns the glow colour for a positive buff. */
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

  /**
   * Items #33-34: Returns the player personal light colour for buff-specific
   * player light tinting, or null if no special tint is needed.
   */
  private buffPlayerLightColor(abilityId: string): number | null {
    const map: Record<string, number> = {
      berserker_rage:     0xff3300, // deep red
      mana_shield:        0x4488ff, // calm blue
      divine_shield:      0xffe066, // holy gold
      aura_of_protection: 0xffe066,
      elemental_infusion: 0xff6644, // molten orange
      spell_echo:         0xcc44ff, // arcane purple
    };
    return map[abilityId] ?? null;
  }

}
