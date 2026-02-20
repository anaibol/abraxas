# Server Rules — Abraxas

Apply these rules when editing any server-side code in `apps/server/`.

## Game Loop (Critical)

- No async/await inside `setSimulationInterval` callbacks
- No DB queries inside the tick loop — persistence is fire-and-forget
- No `new Array()` or object literals in per-entity hot paths (GC pressure)
- All entity maps use `new Map<string, ...>()` initialized once in the system constructor

## Message Handlers

- Every `room.onMessage` must start with a null-check: `const player = room.state.players.get(client.sessionId); if (!player) return;`
- Never trust client-reported values for damage, position, or HP
- Never use raw string literals — always use `ClientMessageType.X` or `ServerMessageType.X` enums

## Schema

- `@schemaType(...)` decorator on every Schema property
- Schema classes = data only; no methods with game-state side-effects
- Use `npcType` not `type` on Npc schema

## Logging

- Use `logger.info/warn/error({ ...fields })` — structured pino logger
- Include `intent` field in every log: `logger.info({ intent: "player_death", sessionId })`
- Never use `console.log` in production server paths

## Death & Cleanup

- Every `onDeath` handler must:
  1. Call `buffSystem.removePlayer(sessionId)`
  2. Call `combatSystem.removeEntity(sessionId)`
  3. Call `spatial.removeFromGrid(entity)`
  4. Remove from `state.players` or `state.npcs`
  5. Schedule respawn (for NPCs) or notify client (for players)
