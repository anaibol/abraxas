// Centralized z-ordering (depth) definitions for the Phaser client
// This prevents bugs where hardcoded depths conflict with dynamic Y-sorting.

export const RENDER_LAYERS = {
  // 1. FLOOR (0 - 999) - Always under characters
  BACKGROUND: 0,
  DECALS: 10,           // Blood, scorch marks, craters
  WATER_OVERLAY: 20,
  TARGETING_TILE: 30,   // Spell range indicators
  GROUND_ITEMS: 40,     // Loot on the floor
  
  // 2. Y-SORT SPACE (1,000 to 9,999)
  // Everything standing up uses: RENDER_LAYERS.Y_SORT_BASE + (pixelY / TILE_SIZE)
  // This guarantees players/trees/NPCs always stack perfectly among themselves
  Y_SORT_BASE: 1000, 

  // 3. AIR / EFFECTS (10,000+) - Always above characters
  PROJECTILES: 10000,   // Fireballs, arrows
  PARTICLES: 11000,     // Explosions, level-up effects
  
  // 4. ENVIRONMENT & UI (20,000+)
  WEATHER_FOG: 20000,   
  AMBIENT_DARKNESS: 21000, // Night time tint
  UI_OVERLAYS: 30000,      // Health bars, names, combat text
};
