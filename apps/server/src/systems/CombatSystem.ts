import type { Ability, BroadcastFn, ServerMessages, TileMap, WindupAction } from "@abraxas/shared";
import {
  ABILITIES,
  BUFFER_WINDOW_MS,
  calcHealAmount,
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  EntityType,
  GCD_MS,
  MathUtils,
  ServerMessageType,
} from "@abraxas/shared";
import type { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import type { BuffSystem } from "./BuffSystem";

type SendToClientFn = <T extends ServerMessageType>(type: T, message?: ServerMessages[T]) => void;

export class CombatSystem {
  private activeWindups = new Map<string, WindupAction>();
  /** Tracks when each entity last started an auto-attack, for attackCooldownMs enforcement. */
  private lastMeleeMs = new Map<string, number>();

  /** Helper to interrupt an entity's cast if they take damage. */
  private interruptCast(sessionId: string, broadcast: BroadcastFn) {
    const windup = this.activeWindups.get(sessionId);
    if (windup && windup.type === "ability") {
      this.activeWindups.delete(sessionId);
      broadcast(ServerMessageType.Notification, {
        message: "game.cast_interrupted",
      });
      // Assuming a hypothetical CastInterrupted message exists, or just clear it silently.
      // We will clear it silently for now if the client doesn't explicitly support it, 
      // but it stops the cast from resolving.
    }
  }

  constructor(
    private state: GameState,
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
    private map: TileMap,
  ) {}

  removeEntity(sessionId: string) {
    this.activeWindups.delete(sessionId);
    this.lastMeleeMs.delete(sessionId);
  }

  /** Turns an entity to face a target tile (no-op when attacker is on the target tile). */
  private faceToward(entity: Entity, tx: number, ty: number): void {
    if (entity.tileX === tx && entity.tileY === ty) return;
    const facing = MathUtils.getDirection(entity.getPosition(), { x: tx, y: ty });
    if (entity.facing !== facing) entity.facing = facing;
  }

  /** Stores a buffered action and returns false (caller should propagate). */
  private bufferAction(entity: Entity, action: Entity["bufferedAction"]): false {
    entity.bufferedAction = action;
    return false;
  }

  hasLineOfSight(p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
    const line = MathUtils.getLine(p1, p2);
    // Skip first tile (attacker). We check the target tile and everything in between.
    for (let i = 1; i < line.length; i++) {
      const tile = line[i];
      if (this.map.collision[tile.y]?.[tile.x] === 1) {
        return false;
      }
    }
    return true;
  }

  // Compatible with ArenaRoom's expectation
  processWindups(
    now: number,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    for (const [sessionId, windup] of this.activeWindups.entries()) {
      if (now >= windup.completeAtMs) {
        this.activeWindups.delete(sessionId);
        this.resolveWindup(windup, broadcast, onDeath, now, onSummon);
      }
    }
  }

  processBufferedActions(
    now: number,
    broadcast: BroadcastFn,
    getSendToClient: (sessionId: string) => SendToClientFn | undefined,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    const entities = [...this.state.players.values(), ...this.state.npcs.values()];
    for (const entity of entities) {
      if (!entity.alive || !entity.bufferedAction) {
        continue;
      }

      const sessionId = entity.sessionId;

      // Skip if still in windup (unless we want to allow overwriting, but current logic is wait)
      if (this.activeWindups.has(sessionId)) continue;

      // Buffer expires if too old
      if (now - entity.bufferedAction.bufferedAt > BUFFER_WINDOW_MS) {
        entity.bufferedAction = null;
        continue;
      }

      const sendToClient = getSendToClient(sessionId);

      if (entity.bufferedAction.type === "attack") {
        if (
          this.tryAttack(
            entity,
            entity.bufferedAction.targetTileX ?? entity.tileX,
            entity.bufferedAction.targetTileY ?? entity.tileY,
            broadcast,
            now,
            sendToClient,
          )
        ) {
          entity.bufferedAction = null;
        }
      } else if (entity.bufferedAction.type === "cast" && entity.bufferedAction.spellId) {
        if (
          this.tryCast(
            entity,
            entity.bufferedAction.spellId,
            entity.bufferedAction.targetTileX ?? entity.tileX,
            entity.bufferedAction.targetTileY ?? entity.tileY,
            broadcast,
            now,
            sendToClient,
          )
        ) {
          entity.bufferedAction = null;
        }
      }
    }
  }

  tryAttack(
    attacker: Entity,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    console.log(
      `[tryAttack] START attacker=${attacker.sessionId} target=${targetTileX},${targetTileY}`,
    );
    if (this.buffSystem.isStunned(attacker.sessionId, now)) return false;

    const stats = attacker.getStats()!;

    const lastMelee = this.lastMeleeMs.get(attacker.sessionId) ?? 0;
    const meleeReady = now >= lastMelee + stats.attackCooldownMs;
    const gcdReady = now >= attacker.lastGcdMs + GCD_MS;

    if (!meleeReady || !gcdReady || this.activeWindups.has(attacker.sessionId)) {
      console.log(
        `[tryAttack] BUFFERING: melee=${meleeReady} gcd=${gcdReady} windup=${this.activeWindups.has(attacker.sessionId)}`,
      );
      return this.bufferAction(attacker, {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
    }

    this.faceToward(attacker, targetTileX, targetTileY);

    const isRanged = stats.attackRange > 1;

    if (isRanged) {
      const target = this.spatial.findEntityAtTile(targetTileX, targetTileY);
      if (!target || !target.alive || !this.canAttack(attacker, target)) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.attackRange) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }

      if (
        !this.hasLineOfSight(attacker.getPosition(), {
          x: targetTileX,
          y: targetTileY,
        })
      ) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    const windup: WindupAction = {
      type: isRanged ? "ranged" : "melee",
      completeAtMs: now + stats.attackWindupMs,
      attackerSessionId: attacker.sessionId,
      targetTileX,
      targetTileY,
    };

    attacker.lastGcdMs = now;
    this.lastMeleeMs.set(attacker.sessionId, now);
    this.activeWindups.set(attacker.sessionId, windup);
    console.log(`[tryAttack] SUCCESS broadcasting AttackStart for ${attacker.sessionId}`);
    broadcast(ServerMessageType.AttackStart, {
      sessionId: attacker.sessionId,
      facing: attacker.facing,
      ...(isRanged ? { targetTileX, targetTileY } : {}),
    });

    return true;
  }

  tryCast(
    caster: Entity,
    abilityId: string,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    console.log(
      `[tryCast] START caster=${caster.sessionId} ability=${abilityId} target=${targetTileX},${targetTileY}`,
    );
    if (this.buffSystem.isStunned(caster.sessionId, now)) {
      console.log("[tryCast] FAIL stunned");
      return false;
    }

    const ability = ABILITIES[abilityId];
    if (!ability) {
      console.log("[tryCast] FAIL no ability", abilityId);
      return false;
    }

    // Class restriction: players may only use abilities assigned to their class
    if (caster.type === EntityType.PLAYER) {
      const pCaster = caster as Player;
      const classStats = pCaster.getStats();
      if (classStats && !classStats.abilities.includes(abilityId)) {
        console.log("[tryCast] FAIL class restriction. abilities:", classStats.abilities);
        sendToClient?.(ServerMessageType.Notification, {
          message: "game.class_restricted",
        });
        return false;
      }

      if (ability.requiredLevel && pCaster.level < ability.requiredLevel) {
        console.log(
          `[tryCast] FAIL level requirement. level=${pCaster.level} required=${ability.requiredLevel}`,
        );
        sendToClient?.(ServerMessageType.Notification, {
          message: "game.skill_locked",
        });
        return false;
      }
    }

    if (now < caster.lastGcdMs + GCD_MS || this.activeWindups.has(caster.sessionId)) {
      console.log(
        `[tryCast] BUFFERING. now=${now} gcd=${caster.lastGcdMs + GCD_MS} windup=${this.activeWindups.has(caster.sessionId)}`,
      );
      return this.bufferAction(caster, {
        type: "cast",
        spellId: abilityId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
    }

    const cd = caster.spellCooldowns.get(abilityId) || 0;
    if (now < cd) {
      console.log(`[tryCast] FAIL cooldown. now=${now} cd=${cd}`);
      return false;
    }

    if (ability.rangeTiles > 0) this.faceToward(caster, targetTileX, targetTileY);

    if (caster.type === EntityType.PLAYER) {
      const pCaster = caster as Player;
      if (pCaster.mana < ability.manaCost) {
        console.log(`[tryCast] FAIL mana. has=${pCaster.mana} needs=${ability.manaCost}`);
        sendToClient?.(ServerMessageType.Notification, {
          message: "game.not_enough_mana",
        });
        return false;
      }
    }

    if (ability.rangeTiles > 0) {
      const dist = MathUtils.manhattanDist(caster.getPosition(), {
        x: targetTileX,
        y: targetTileY,
      });
      if (dist > ability.rangeTiles) {
        console.log(`[tryCast] FAIL range. dist=${dist} max=${ability.rangeTiles}`);
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      if (
        !this.hasLineOfSight(caster.getPosition(), {
          x: targetTileX,
          y: targetTileY,
        })
      ) {
        console.log("[tryCast] FAIL LOS");
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    if (caster.type === EntityType.PLAYER) {
      (caster as Player).mana -= ability.manaCost;
    }

    caster.lastGcdMs = now;
    caster.spellCooldowns.set(abilityId, now + ability.cooldownMs);
    // Prevent an instant auto-attack following an ability — treat the ability cast as consuming the melee timer too
    this.lastMeleeMs.set(caster.sessionId, now);

    const windup: WindupAction = {
      type: "ability",
      abilityId,
      completeAtMs: now + ability.windupMs,
      attackerSessionId: caster.sessionId,
      targetTileX,
      targetTileY,
    };

    this.activeWindups.set(caster.sessionId, windup);
    console.log("[tryCast] SUCCESS - broadcasting CastStart");
    broadcast(ServerMessageType.CastStart, {
      sessionId: caster.sessionId,
      abilityId,
      targetTileX,
      targetTileY,
    });

    return true;
  }

  private resolveWindup(
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    const attacker = this.spatial.findEntityBySessionId(windup.attackerSessionId);
    if (!attacker || !attacker.alive) return;

    if (windup.type === "melee" || windup.type === "ranged") {
      this.resolveAutoAttack(attacker, windup, broadcast, onDeath, now);
    } else {
      this.resolveAbility(attacker, windup, broadcast, onDeath, now, onSummon);
    }
  }

  private resolveAutoAttack(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
  ): void {
    const target = this.spatial.findEntityAtTile(windup.targetTileX, windup.targetTileY);

    if (target && target.alive && this.canAttack(attacker, target)) {
      const stats = attacker.getStats()!;
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.attackRange) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: null,
        });
        return;
      }

      if (this.buffSystem.isInvulnerable(target.sessionId, now)) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
        return;
      }

      const attackerStr = this.boosted(attacker, "str", now);
      const attackerAgi = this.boosted(attacker, "agi", now);
      const defenderArmor = this.boosted(target, "armor", now);
      const defenderAgi = this.boosted(target, "agi", now);

      const result =
        windup.type === "ranged"
          ? calcRangedDamage(attackerAgi, defenderArmor, defenderAgi)
          : calcMeleeDamage(attackerStr, defenderArmor, defenderAgi);

      if (result.dodged) {
        console.log("[resolveAutoAttack] target dodged!");
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
      } else {
        console.log(
          `[resolveAutoAttack] HIT! damage=${result.damage}. hpBefore=${target.hp + result.damage}`,
        );
        target.hp -= result.damage;
        this.interruptCast(target.sessionId, broadcast);
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
        });
        broadcast(ServerMessageType.Damage, {
          targetSessionId: target.sessionId,
          amount: result.damage,
          hpAfter: target.hp,
          type: "physical",
        });

        if (target.hp <= 0) {
          onDeath(target, attacker.sessionId);
        }
      }
    } else {
      console.log(`[resolveAutoAttack] Miss! Target not found or dead.`);
      broadcast(ServerMessageType.AttackHit, {
        sessionId: attacker.sessionId,
        targetSessionId: null,
      });
    }
  }

  private resolveAbility(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ): void {
    const ability = ABILITIES[windup.abilityId!];
    if (!ability) return;

    // Handle summon abilities
    if (ability.id.startsWith("summon_") && onSummon) {
      onSummon(attacker, ability.id, windup.targetTileX, windup.targetTileY);
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      return;
    }

    // AoE heal — heals all same-faction entities (including caster) in radius.
    // Handled before the rangeTiles === 0 check so aoeRadius is respected.
    if (ability.effect === "aoe_heal") {
      const radius = ability.aoeRadius ?? 3;
      const candidates = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        radius,
      );
      for (const candidate of candidates) {
        const isAlly =
          candidate.sessionId === attacker.sessionId || this.sameFaction(attacker, candidate);
        if (!isAlly || !candidate.alive) continue;
        const scalingStat = this.boosted(attacker, ability.scalingStat, now);
        const healAmount = calcHealAmount(ability.baseDamage, scalingStat, ability.scalingRatio);
        const maxHp = this.boosted(candidate, "hp", now);
        candidate.hp = Math.min(maxHp, candidate.hp + healAmount);
        broadcast(ServerMessageType.Heal, {
          sessionId: candidate.sessionId,
          amount: healAmount,
          hpAfter: candidate.hp,
        });
      }
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      return;
    }

    // Self-target abilities (rangeTiles === 0) always target the caster.
    // AoE abilities with rangeTiles === 0 target a radius around the caster.
    if (ability.rangeTiles === 0) {
      const aoeRadius = ability.aoeRadius ?? 0;
      if (aoeRadius > 0) {
        // Play the main AoE effect once at the caster tile — not once per victim.
        broadcast(ServerMessageType.CastHit, {
          sessionId: attacker.sessionId,
          abilityId: ability.id,
          targetTileX: attacker.tileX,
          targetTileY: attacker.tileY,
          fxId: ability.fxId,
        });
        const victims = this.spatial.findEntitiesInRadius(
          attacker.tileX,
          attacker.tileY,
          aoeRadius,
        );
        for (const victim of victims) {
          if (!this.isValidTarget(attacker, victim, ability)) continue;
          // Suppress per-victim CastHit; the main one was already broadcast above.
          this.applyAbilityToTarget(attacker, victim, ability, broadcast, onDeath, now, true);
        }
      } else {
        if (this.isValidTarget(attacker, attacker, ability)) {
          this.applyAbilityToTarget(attacker, attacker, ability, broadcast, onDeath, now);
        }
      }
      return;
    }

    const aoeRadius = ability.aoeRadius ?? 0;
    if (aoeRadius > 0) {
      // Play the main AoE effect once at the intended target tile regardless of hits.
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      const victims = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        aoeRadius,
      );
      for (const victim of victims) {
        if (!this.isValidTarget(attacker, victim, ability)) continue;

        // LOS check for AOE
        if (
          !this.hasLineOfSight(
            { x: windup.targetTileX, y: windup.targetTileY },
            { x: victim.tileX, y: victim.tileY },
          )
        ) {
          continue;
        }

        // Suppress per-victim CastHit; the main one was already broadcast above.
        this.applyAbilityToTarget(attacker, victim, ability, broadcast, onDeath, now, true);
      }
    } else {
      const target = this.spatial.findEntityAtTile(windup.targetTileX, windup.targetTileY);
      if (target && target.alive) {
        const valid = this.isValidTarget(attacker, target, ability);
        if (valid) {
          const dist = MathUtils.manhattanDist(attacker.getPosition(), {
            x: target.tileX,
            y: target.tileY,
          });
          if (dist > ability.rangeTiles) return;
          console.log(`[resolveAbility] SUCCESS targeting ${target.sessionId} at ${target.tileX},${target.tileY}`);
          this.applyAbilityToTarget(attacker, target, ability, broadcast, onDeath, now);
        } else {
          console.log(`[resolveAbility] isValidTarget FAILED for ${target.sessionId}`);
        }
      } else {
        console.log(`[resolveAbility] No alive target found at ${windup.targetTileX},${windup.targetTileY}.`);
      }
    }
  }

  private sameFaction(a: Entity, b: Entity): boolean {
    // Check for owner-pet or pet-pet relation
    const aOwnerId = (a as any).ownerId;
    const bOwnerId = (b as any).ownerId;

    if (aOwnerId && aOwnerId === b.sessionId) return true;
    if (bOwnerId && bOwnerId === a.sessionId) return true;
    if (aOwnerId && bOwnerId && aOwnerId === bOwnerId) return true;

    if (a.type === EntityType.PLAYER && b.type === EntityType.PLAYER) {
      const pA = a as Player;
      const pB = b as Player;
      if (pA.groupId && pA.groupId === pB.groupId) return true;
      if (pA.guildId && pA.guildId === pB.guildId) return true;
      return false;
    }
    if (a.type !== EntityType.PLAYER && b.type !== EntityType.PLAYER) {
      return a.type === b.type;
    }
    return false;
  }

  private canAttack(attacker: Entity, target: Entity): boolean {
    if (attacker.sessionId === target.sessionId) return false;
    if (this.sameFaction(attacker, target)) return false;
    if (attacker.type === EntityType.PLAYER && target.type === EntityType.PLAYER) {
      const pAttacker = attacker as Player;
      const pTarget = target as Player;
      if (!pAttacker.pvpEnabled || !pTarget.pvpEnabled) return false;
      if (
        this.isInSafeZone(attacker.tileX, attacker.tileY) ||
        this.isInSafeZone(target.tileX, target.tileY)
      )
        return false;
    }
    return true;
  }

  private isValidTarget(attacker: Entity, target: Entity, ability: Ability): boolean {
    const harmful =
      ["damage", "dot", "stun", "debuff", "leech", "reveal"].includes(ability.effect) ||
      ability.baseDamage > 0 ||
      ability.buffStat === "stun";

    if (harmful) {
      return this.canAttack(attacker, target);
    } else {
      if (attacker.sessionId === target.sessionId) return true;
      return this.sameFaction(attacker, target);
    }
  }

  private isInSafeZone(x: number, y: number): boolean {
    if (!this.map.safeZones) return false;
    for (const zone of this.map.safeZones) {
      if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
        return true;
      }
    }
    return false;
  }

  private applyAbilityToTarget(
    attacker: Entity,
    target: Entity,
    ability: Ability,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    /** When true, skips the CastHit broadcast (AoE callers broadcast it once themselves). */
    suppressCastHit = false,
  ) {
    if (target.type === EntityType.NPC && (target as Npc).npcType === "merchant") return;

    const isSelfCast = attacker.sessionId === target.sessionId;
    if (!isSelfCast && this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    const scalingStatName = ability.scalingStat || "int";
    const scalingStatValue = this.boosted(attacker, scalingStatName, now);

    if (ability.effect === "stealth") {
      this.buffSystem.applyStealth(target.sessionId, ability.durationMs ?? 5000, now);
      broadcast(ServerMessageType.StealthApplied, {
        sessionId: target.sessionId,
        durationMs: ability.durationMs ?? 5000,
      });
    } else if (ability.effect === "cleanse") {
      this.buffSystem.clearStun(target.sessionId);
      // We can reuse BuffApplied for a positive visual or just rely on CastHit fxId
    } else if (ability.effect === "reveal") {
      this.buffSystem.breakStealth(target.sessionId);
    } else if (ability.effect === "dot") {
      const dotDuration = ability.dotDurationMs ?? ability.durationMs ?? 5000;
      this.buffSystem.addDoT(
        target.sessionId,
        attacker.sessionId,
        ability.id,
        ability.dotDamage ?? ability.baseDamage,
        ability.dotIntervalMs ?? 1000,
        dotDuration,
        now,
      );
      // Notify the client so it can show the poison/dot visual state.
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: dotDuration,
      });
    } else if (ability.effect === "leech") {
      const damage = this.calcAbilityDamage(attacker, target, ability, scalingStatValue, now);
      target.hp -= damage;
      this.interruptCast(target.sessionId, broadcast);
      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: damage,
        hpAfter: target.hp,
        type: ability.damageSchool === "physical" ? "physical" : "magic",
      });
      if (target.hp <= 0) {
        onDeath(target, attacker.sessionId);
      }
      const healBack = Math.max(1, Math.round(damage * (ability.leechRatio ?? 0.5)));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healBack);
      broadcast(ServerMessageType.Heal, {
        sessionId: attacker.sessionId,
        amount: healBack,
        hpAfter: attacker.hp,
      });
    } else if (ability.effect === "damage" || ability.baseDamage > 0) {
      const damage = this.calcAbilityDamage(attacker, target, ability, scalingStatValue, now);
      target.hp -= damage;
      this.interruptCast(target.sessionId, broadcast);
      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: damage,
        hpAfter: target.hp,
        type: ability.damageSchool === "physical" ? "physical" : "magic",
      });
      if (target.hp <= 0) {
        onDeath(target, attacker.sessionId);
      }
      // Apply secondary stat modifier (e.g. ice_bolt AGI slow) if defined alongside damage
      if (
        !isSelfCast &&
        ability.buffStat &&
        ability.buffAmount !== undefined &&
        ability.durationMs
      ) {
        this.buffSystem.addBuff(
          target.sessionId,
          `${ability.id}_slow`,
          ability.buffStat,
          ability.buffAmount,
          ability.durationMs,
          now,
        );
        broadcast(ServerMessageType.BuffApplied, {
          sessionId: target.sessionId,
          abilityId: ability.id,
          durationMs: ability.durationMs,
        });
      }
    } else if (ability.effect === "heal") {
      const heal = calcHealAmount(ability.baseDamage, scalingStatValue, ability.scalingRatio);
      const maxHp = this.boosted(target, "hp", now);
      target.hp = Math.min(maxHp, target.hp + heal);
      broadcast(ServerMessageType.Heal, {
        sessionId: target.sessionId,
        amount: heal,
        hpAfter: target.hp,
      });
    } else if (ability.effect === "stun" || ability.buffStat === "stun") {
      this.buffSystem.applyStun(target.sessionId, ability.durationMs ?? 1000, now);
      broadcast(ServerMessageType.StunApplied, {
        targetSessionId: target.sessionId,
        durationMs: ability.durationMs ?? 1000,
      });
    } else if (ability.effect === "debuff") {
      // Applies a negative stat modifier to reduce the target's effectiveness.
      this.buffSystem.addBuff(
        target.sessionId,
        ability.id,
        ability.buffStat ?? "armor",
        -(ability.buffAmount ?? 10),
        ability.durationMs ?? 5000,
        now,
      );
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: ability.durationMs ?? 5000,
      });
    } else if (ability.effect === "buff" || ability.buffStat) {
      this.buffSystem.addBuff(
        target.sessionId,
        ability.id,
        ability.buffStat ?? "armor",
        ability.buffAmount ?? 10,
        ability.durationMs ?? 5000,
        now,
        ability.appearanceOverride?.bodyId,
        ability.appearanceOverride?.headId,
      );
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: ability.durationMs ?? 5000,
      });
    }

    // Broadcast CastHit so clients play the ability visual effect.
    // AoE callers already broadcast this once at the target tile; skip per-victim duplicates.
    if (!suppressCastHit) {
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: target.tileX,
        targetTileY: target.tileY,
        fxId: ability.fxId,
      });
    }
  }

  /**
   * Routes ability damage to the correct formula based on damageSchool.
   * Physical abilities use armor reduction (and dodge for melee-range).
   * Magical abilities use INT-based magic resistance.
   */
  private calcAbilityDamage(
    attacker: Entity,
    target: Entity,
    ability: Ability,
    scalingStatValue: number,
    now: number,
  ): number {
    if (ability.damageSchool === "physical") {
      const defenderArmor = this.boosted(target, "armor", now);
      const defenderAgi = this.boosted(target, "agi", now);
      // STR-scaling abilities can be dodged; AGI-scaling (ranged) abilities cannot
      if (ability.scalingStat !== "agi") {
        const dodgeChance = Math.max(0, (defenderAgi - 10) * 0.01);
        if (Math.random() < dodgeChance) return 0;
      }
      const raw = ability.baseDamage + scalingStatValue * ability.scalingRatio;
      return Math.max(1, Math.round(raw * (1 - defenderArmor / (defenderArmor + 50))));
    }

    // magical
    const defenderInt = this.boosted(target, "int", now);
    return calcSpellDamage(ability.baseDamage, scalingStatValue, ability.scalingRatio, defenderInt);
  }

  private boosted(entity: Entity, stat: string, now: number): number {
    const bases: Record<string, number> = {
      str: entity.str,
      agi: entity.agi,
      int: entity.intStat,
      intStat: entity.intStat,
      armor: entity.armor,
      hp: entity.maxHp,
    };
    return (bases[stat] ?? 0) + this.buffSystem.getBuffBonus(entity.sessionId, stat, now);
  }
}
