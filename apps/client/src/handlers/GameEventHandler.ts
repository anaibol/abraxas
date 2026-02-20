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
import type { EffectManager } from "../managers/EffectManager";
import type { LightManager } from "../managers/LightManager";
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
    /** Optional — if provided, heavy-impact spells shake the camera. */
    private onCameraShake?: (intensity: number, durationMs: number) => void,
    /** Optional — if provided, spell impacts flash a Lights2D point light. */
    private lightManager?: LightManager,
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
    on(ServerMessageType.LevelUp, (data) => this.onLevelUp(data));
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
    let isRanged = false;
    if (data.targetTileX !== undefined && data.targetTileY !== undefined) {
      if (sprite) {
        const casterTileX = Math.round(sprite.renderX / TILE_SIZE);
        const casterTileY = Math.round(sprite.renderY / TILE_SIZE);
        const dx = data.targetTileX - casterTileX;
        const dy = data.targetTileY - casterTileY;
        if (Math.sqrt(dx * dx + dy * dy) >= 1.5) {
          isRanged = true;
        }
      }
      this.effectManager.maybeLaunchAttackProjectile(
        data.sessionId,
        data.targetTileX,
        data.targetTileY,
      );
    }

    if (isRanged) {
      this.soundManager.playBow();
    } else {
      const npc = this.room.state.npcs.get(data.sessionId);
      if (npc) {
        this.soundManager.playNpcAttack(npc.type);
      } else {
        this.soundManager.playAttack();
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

    // ── Per-spell SFX ──────────────────────────────────────────────────────────
    // Each ability now plays its own tailored sound instead of a generic "spell".
    this.soundManager.playSpellSfx(data.abilityId);

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

    // ── Camera Shake for heavy-impact spells ───────────────────────────────────
    if (HEAVY_HIT_ABILITIES.has(data.abilityId)) {
      this.onCameraShake?.(0.009, 220);
    }

    // ── Spell-impact light flash ────────────────────────────────────────────────
    if (this.lightManager) {
      const px = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
      const py = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;
      const lightColor = this.spellLightColor(data.abilityId);
      if (lightColor !== null) {
        this.lightManager.flashLight(px, py, lightColor, 180, 2.5, 350);
      }
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
      // ── Debuff Glow (red/purple) ──────────────────────────────────────────
      this.spriteManager.applyGlowFx(data.sessionId, 0xcc44ff, durationMs);
    } else if (effect === "stun") {
      this.spriteManager.applyStunVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_stunned")} ✦`, "#ffff44");
      // ── Stun Glow (gold) ──────────────────────────────────────────────────
      this.spriteManager.applyGlowFx(data.sessionId, 0xffdd44, durationMs);
    } else if (effect === "stealth") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_stealth"), "#aaddff");
    } else if (data.abilityId === "divine_shield") {
      this.spriteManager.applyInvulnerableVisual(data.sessionId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_invulnerable"), "#ffffff");
      // ── Invulnerable Glow (white) ─────────────────────────────────────────
      this.spriteManager.applyGlowFx(data.sessionId, 0xffffff, durationMs);
    } else if (effect === "dot") {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, t("game.buff_poisoned"), "#44ff44");
      // ── DoT Glow (green) ──────────────────────────────────────────────────
      this.spriteManager.applyGlowFx(data.sessionId, 0x44ff44, durationMs);
    } else {
      this.spriteManager.applySpellStateVisual(data.sessionId, data.abilityId, durationMs);
      this.effectManager.showFloatingText(data.sessionId, `${t("game.buff_buffed")} ✦`, "#ffdd44");
      // ── Positive buff Glow (class-specific or golden) ─────────────────────
      const buffColor = this.buffGlowColor(data.abilityId);
      this.spriteManager.applyGlowFx(data.sessionId, buffColor, durationMs);
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
    if (this.isSelf(data.sessionId)) {
      this.soundManager.playLevelUp();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Returns the light color for a spell impact flash, or null if no flash. */
  private spellLightColor(abilityId: string): number | null {
    const FIRE = ["fireball", "meteor_strike", "fire_breath", "war_cry", "execute"];
    const ICE  = ["ice_bolt", "frost_nova", "frost_breath", "polymorph"];
    const GOLD = ["holy_nova", "judgment", "consecration", "smite", "holy_bolt", "holy_strike", "lay_on_hands"];
    const ELEC = ["thunderstorm", "chain_lightning", "leap", "whirlwind"];
    const DARK = ["shadow_bolt", "soul_drain", "banshee_wail", "curse"];
    const GRNE = ["heal", "cleansing_rain", "entangling_roots", "poison_arrow", "acid_splash"];

    if (FIRE.includes(abilityId)) return 0xff6622;
    if (ICE.includes(abilityId))  return 0x88ccff;
    if (GOLD.includes(abilityId)) return 0xffe066;
    if (ELEC.includes(abilityId)) return 0xccddff;
    if (DARK.includes(abilityId)) return 0x9944cc;
    if (GRNE.includes(abilityId)) return 0x44ee66;
    return null; // No flash for this ability
  }

  /** Returns the glow FX colour for a positive buff. */
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
}
