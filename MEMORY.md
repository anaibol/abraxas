# Abraxas — Hard Rules (Never Break)

These are non-negotiables. They survive long sessions and override any other context.

## Simulation Integrity

- **Server is the only authority** — clients send inputs only; never trust client-reported state
- **No per-tick allocations** in the hot path — reuse maps/arrays, do not create objects inside `setSimulationInterval` callbacks
- **Fixed-timestep tick loop** — 20 TPS (50ms intervals); never change this without explicit approval
- **Deterministic combat formulas** — all damage/heal calculations use only integer or Math.round/ceil/floor; no floating-point `==` comparisons

## Network / Protocol

- **All messages are typed** — every `room.onMessage` and `broadcast` must have a matching `ClientMessageType` or `ServerMessageType` enum entry in `@abraxas/shared`
- **Never broadcast sensitive data** — HP/position of stealthed players must not be visible to enemy clients
- **No async inside message handlers** — DB persistence is fire-and-forget; game state updates are always synchronous

## State Schema

- **Schema classes are data-only** — no methods with side effects, no logic inside getters/setters
- **`npcType` not `type`** on the Npc schema — `type` is reserved by Colyseus Schema internals
- **`EntityType` enum for type narrowing** — prefer `entity.type === EntityType.PLAYER` over `instanceof Player` in shared/system code

## Code Hygiene

- **No `@ts-ignore`** — fix the underlying type issue
- **No `as any`** — narrow properly
- **No `console.log` in server systems** — use `logger.info/warn/error({...})`
- **No DB calls in the tick loop** — `PrismaService` calls belong in handlers/services, persisted async

## Shared Package

- **`@abraxas/shared` is the single source of truth** for all types, constants, and formulas
- **Never duplicate types** across client, server, or tools — always import from `@abraxas/shared`
- **Combat formulas are pure functions** — `calcMeleeDamage`, `calcSpellDamage`, `calcHealAmount` must remain side-effect-free

## Content

- **Audio = Opus `.ogg` only** — no MP3, WAV, or uncompressed formats
- **All i18n keys must exist in all locale files** — run `bun run check:i18n` before shipping
- **All asset references must resolve** — run `bun run check:assets` before shipping
