# Abraxas Arena

A 2D tile-based PvP multiplayer game inspired by classic Argentum Online.

Built with **Phaser 4 RC** + **Colyseus** + **Bun**.

## Architecture

```
/ao5
  /packages
    /shared          # Types, config, maps (shared between client & server)
  /apps
    /server          # Colyseus authoritative game server
    /client          # Vite + Phaser 4 RC client
```

## Setup

```bash
# Install all dependencies
bun install
```

## Development

```bash
# Terminal 1: Start the server
bun run dev:server

# Terminal 2: Start the client
bun run dev:client
```

- Server runs on `ws://localhost:2567` (configurable via `PORT` env)
- Client runs on `http://localhost:3000`

## Testing

```bash
# Run the deterministic multiplayer smoke test
bun test
```

The smoke test:

1. Starts a server with `arena.test.json` (10x10 deterministic map)
2. Connects a Warrior (Client A) and Wizard (Client B)
3. Tests movement (including blocked/occupied tiles)
4. Tests melee attack with windup + damage
5. Tests wizard fireball with mana deduction + spell damage
6. Disconnects cleanly

## Configuration

### Environment Variables

| Variable     | Default | Description                        |
| ------------ | ------- | ---------------------------------- |
| `PORT`       | `2567`  | Server WebSocket port              |
| `MAP`        | `arena` | Map name (loads from shared/maps/) |
| `LOG_LEVEL`  | `info`  | `debug`, `info`, `warn`, `error`   |
| `LOG_FORMAT` | `json`  | `json` or `text`                   |

### Tick Tuning

All timing values are in `packages/shared/src/config.ts`:

| Constant           | Value | Description                     |
| ------------------ | ----- | ------------------------------- |
| `TICK_RATE`        | 20    | Server ticks per second         |
| `TICK_MS`          | 50    | Milliseconds per tick           |
| `GCD_MS`           | 120   | Global cooldown between actions |
| `BUFFER_WINDOW_MS` | 200   | Input buffer expiration         |
| `TILE_SIZE`        | 32    | Pixels per tile                 |

## How to Add Classes

1. Add stats to `CLASS_STATS` in `packages/shared/src/config.ts`:

```typescript
CLASS_STATS["ranger"] = {
  hp: 100,
  mana: 80,
  meleeDamage: 15,
  spellDamage: 20,
  speedTilesPerSecond: 5,
  meleeCooldownMs: 400,
  meleeWindupMs: 100,
  spellCooldownMs: 300,
  spellWindupMs: 100,
};
```

2. Update the `ClassType` union in `packages/shared/src/types.ts`
3. Add the option to the client's class select dropdown in `apps/client/index.html`

## How to Add Spells

1. Add the spell definition to `SPELLS` in `packages/shared/src/config.ts`:

```typescript
SPELLS["ice_bolt"] = {
  id: "ice_bolt",
  rangeTiles: 8,
  manaCost: 30,
};
```

2. Add the keybinding in `apps/client/src/systems/InputHandler.ts`
3. Add VFX handling in `apps/client/src/scenes/GameScene.ts`

Spell damage is determined by the caster's `spellDamage` class stat.

## How to Modify Maps

Maps are JSON files in `packages/shared/src/maps/`. Format:

```json
{
  "width": 40,
  "height": 30,
  "tileSize": 32,
  "collision": [[0,0,1,...], ...],
  "spawns": [{"x": 5, "y": 5}, ...]
}
```

- `collision[y][x]`: `0` = walkable, `1` = blocked
- `spawns`: Array of spawn points, assigned round-robin to joining players
- Load a custom map: `MAP=mymap bun run dev:server`

## Authoritative Boundaries

The server is the single source of truth:

- **Movement**: Server validates bounds, collision, occupied tiles, and speed limits. Client sends intents; server applies or rejects.
- **Combat**: Server validates cooldowns, GCD, mana, range. Damage is calculated server-side. Client only sees broadcast events.
- **Position**: Server never trusts client position. The `tileX`/`tileY` in the schema are authoritative.
- **State sync**: Full state is sent on join, delta patches at 20hz thereafter.
- **Input buffering**: Server buffers 1 combat action for 200ms if player is in cooldown/windup.

## Camera System

- Camera always follows the **local player's sprite render position** (interpolated, not raw tile position)
- Uses `Phaser.Camera.startFollow()` with configurable lerp (0.15)
- Camera is clamped to world bounds (`camera.setBounds(0, 0, worldWidth, worldHeight)`)
- At map edges, the camera stops but the player can still reach edge tiles
- Remote players do not affect camera position
- Camera moves smoothly as the player sprite interpolates between tiles

## Visual Interpolation

- Logical tile position is authoritative (server schema)
- Sprites interpolate toward the target pixel position at `speedTilesPerSecond * tileSize` pixels/sec
- Server corrections beyond 3 tiles snap instantly
- Corrections within 1.5 tiles use normal speed; between 1.5-3 tiles use 3x speed for fast correction

## Bun Compatibility Note

The server includes a monkey-patch for `@colyseus/ws-transport` to ensure binary frames are sent correctly when running under Bun. The `ws` library sends plain `number[]` arrays as text frames in Bun; the patch converts them to `Uint8Array` before sending.
