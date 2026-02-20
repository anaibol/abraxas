/**
 * Canonical audio asset manifest. All paths are relative to `/public`.
 * All files use the Opus codec in an Ogg container.
 */
export const AudioAssets = {
  // Footsteps
  STEP_1: "audio/kenney_rpg/Audio/footstep00.ogg",
  STEP_2: "audio/kenney_rpg/Audio/footstep01.ogg",
  STEP_3: "audio/kenney_rpg/Audio/footstep02.ogg",
  STEP_4: "audio/kenney_rpg/Audio/footstep03.ogg",
  STEP_5: "audio/kenney_rpg/Audio/footstep04.ogg",

  // Attacks
  ATTACK_1: "audio/kenney_rpg/Audio/drawknife1.ogg",
  ATTACK_2: "audio/kenney_rpg/Audio/drawknife2.ogg",
  ATTACK_3: "audio/kenney_rpg/Audio/drawknife3.ogg",

  // Hits
  HIT_1: "audio/kenney_impact/Audio/impactmetal-heavy-000.ogg",
  HIT_2: "audio/kenney_impact/Audio/impactmetal-heavy-001.ogg",
  HIT_3: "audio/kenney_impact/Audio/impactmetal-heavy-002.ogg",

  // Magic / Spells
  SPELL: "audio/magic/fx411.ogg",
  HEAL: "audio/magic/replenish.ogg",
  BUFF: "audio/magic/montage-sfx-20130926-031949.ogg",
  STEALTH: "audio/magic/shimmer-1.ogg",
  SUMMON: "audio/magic/ghost-1.ogg",
  MAGIC_HIT: "audio/magic/fx261.ogg",

  // Combat / Misc SFX
  DEATH: "audio/sonidos/14.ogg",
  BOW: "audio/misc/archers-shooting.ogg",
  SWORD: "audio/npc/sword-sfx.ogg",

  // UI
  LEVEL_UP: "audio/kenney_ui/Audio/maximize-006.ogg",
  NOTIFICATION: "audio/kenney_ui/Audio/bong-001.ogg",
  CLICK: "audio/kenney_ui/Audio/click-002.ogg",
  CLICK_HOVER: "audio/kenney_ui/Audio/tick-001.ogg",
  CLICK_OPEN: "audio/kenney_ui/Audio/open-001.ogg",
  CLICK_CLOSE: "audio/kenney_ui/Audio/close-001.ogg",
  QUEST_ACCEPT: "audio/kenney_ui/Audio/confirmation-001.ogg",
  QUEST_COMPLETE: "audio/kenney_ui/Audio/confirmation-002.ogg",
  COINS: "audio/kenney_rpg/Audio/handlecoins.ogg",
  MOUNT: "audio/kenney_rpg/Audio/clothbelt.ogg",

  // Ambiance
  AMBIANCE_WIND: "audio/ambiance/wind.ogg",
  AMBIANCE_CRICKETS: "audio/ambiance/crickets.ogg",

  // Music
  MUSIC_ARENA: "audio/musica/101.ogg",

  // NPC
  NPC_RATTLE: "audio/npc/skeleton-rattle.ogg",
  NPC_GRUNT: "audio/npc/creatures/grunt-01.ogg",
  NPC_ROAR: "audio/npc/creatures/roar-01.ogg",
  NPC_SCREAM: "audio/npc/creatures/scream-01.ogg",
  NPC_HURT: "audio/npc/creatures/hurt-01.ogg",
  NPC_LEVEL_UP: "audio/kenney_ui/Audio/maximize-008.ogg",

  // Spells (extended)
  SPELL_MAGICAL_1: "audio/spells/magical-1-0.ogg",
} as const;

export type AudioAssetKey = keyof typeof AudioAssets;
