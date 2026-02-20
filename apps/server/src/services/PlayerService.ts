import type {
  ClassType,
  Direction,
  EquipmentData,
  InventoryEntry,
  NpcType,
} from "@abraxas/shared";
import { EXP_TABLE, ITEMS, STARTING_EQUIPMENT } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import { InventoryItem } from "../schema/InventoryItem";
import { Player } from "../schema/Player";
import type { FriendsSystem } from "../systems/FriendsSystem";
import type { InventorySystem } from "../systems/InventorySystem";
import type { QuestSystem } from "../systems/QuestSystem";
import type { SpatialLookup } from "../utils/SpatialLookup";
import { type FullCharacter, PersistenceService } from "./PersistenceService";

export class PlayerService {
  constructor(
    private state: GameState,
    private inventorySystem: InventorySystem,
    private spatial: SpatialLookup,
    private quests: QuestSystem,
    private friends: FriendsSystem,
  ) {}

  async createPlayer(client: Client, char: FullCharacter, userId: string): Promise<Player> {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.dbId = char.id;
    player.userId = userId;
    player.name = char.name;
    player.classType = char.class;
    player.tileX = char.x;
    player.tileY = char.y;
    player.pvpEnabled = char.pvpEnabled;

    const stats = char.stats;
    if (stats) {
      player.hp = stats.hp;
      player.maxHp = stats.maxHp;
      player.mana = stats.mp;
      player.maxMana = stats.maxMp;
      player.str = stats.str;
      player.agi = stats.agi;
      player.intStat = stats.int;
    }

    player.gold = char.gold;
    player.level = char.level;
    player.xp = char.exp;
    player.maxXp = EXP_TABLE[player.level] ?? 100;

    if (char.inventory?.slots) {
      for (const slot of char.inventory.slots) {
        if (slot.item?.itemDef) {
          const invItem = new InventoryItem();
          invItem.itemId = slot.item.itemDef.code;
          invItem.quantity = slot.qty;
          invItem.slotIndex = slot.idx;
          player.inventory.push(invItem);
        }
      }
    }

    const facingStr = char.facing.toUpperCase();
    player.facing =
      facingStr === "UP"
        ? Direction.UP
        : facingStr === "LEFT"
          ? Direction.LEFT
          : facingStr === "RIGHT"
            ? Direction.RIGHT
            : Direction.DOWN;
    player.alive = player.hp > 0;

    // Starting gear logic
    if (this.isPlayerTotallyNew(player)) {
      this.giveStartingGear(player);
    }

    // Apply equipment
    if (char.equipments) {
      for (const eq of char.equipments) {
        if (eq.item?.itemDef) {
          const code = eq.item.itemDef.code;
          switch (eq.slot) {
            case "WEAPON_MAIN":
              player.equipWeapon = code;
              break;
            case "WEAPON_OFF":
              player.equipShield = code;
              break;
            case "HEAD":
              player.equipHelmet = code;
              break;
            case "CHEST":
              player.equipArmor = code;
              break;
            case "RING1":
              player.equipRing = code;
              break;
            case "MOUNT":
              player.equipMount = code;
              break;
          }
        }
      }
      this.inventorySystem.recalcStats(player);
      player.hp = Math.min(player.hp, player.maxHp);
      player.mana = Math.min(player.mana, player.maxMana);
    }

    // Attach saved companions to player for the Room to spawn, or spawn them here if we have NpcSystem...
    // Actually, we don't have NpcSystem in PlayerService constructor. Let's just store them on the Player object temporarily
    // so the Room can read them after createPlayer.
    if (char.companions && char.companions.length > 0) {
      player.savedCompanions = char.companions.map((c) => ({
        type: c.type as NpcType,
        level: c.level,
        exp: c.exp,
        hp: c.hp,
      }));
    }

    return player;
  }

  public isPlayerTotallyNew(player: Player): boolean {
    return (
      player.inventory.length === 0 &&
      !player.equipWeapon &&
      !player.equipArmor &&
      !player.equipShield &&
      !player.equipHelmet &&
      player.gold === 0
    );
  }

  private giveStartingGear(player: Player) {
    const startingGear = STARTING_EQUIPMENT[player.classType];
    if (startingGear) {
      player.gold = startingGear.gold;
      for (const itemId of startingGear.items) {
        this.inventorySystem.addItem(player, itemId);
        const def = ITEMS[itemId];
        if (def && def.slot !== "consumable") {
          this.inventorySystem.equipItem(player, itemId);
        }
      }
      this.inventorySystem.recalcStats(player);
      player.hp = player.maxHp;
      player.mana = player.maxMana;
    }
  }

  async savePlayer(player: Player, mapId: string) {
    const inventory: InventoryEntry[] = [];
    player.inventory.forEach((item) => {
      inventory.push({
        itemId: item.itemId,
        quantity: item.quantity,
        slotIndex: item.slotIndex,
      });
    });

    const equipment: EquipmentData = {
      weapon: player.equipWeapon,
      shield: player.equipShield,
      helmet: player.equipHelmet,
      armor: player.equipArmor,
      ring: player.equipRing,
      mount: player.equipMount,
    };

    await PersistenceService.saveChar(player.dbId, {
      x: player.tileX,
      y: player.tileY,
      mapId,
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      str: player.str,
      agi: player.agi,
      intStat: player.intStat,
      facing: player.facing,
      gold: player.gold,
      level: player.level,
      xp: player.xp,
      maxXp: player.maxXp,
      inventory,
      equipment,
      classType: player.classType,
      companions: [], // We will populate this from the active NPCs in the room
    };

    // Find active companions owned by this player
    this.state.npcs.forEach((npc) => {
      if (npc.ownerId === player.sessionId && npc.alive) {
        saveData.companions.push({
          type: npc.type,
          level: npc.level,
          exp: npc.exp,
          hp: npc.hp,
        });
      }
    });

    await PersistenceService.saveChar(player.dbId, saveData);
  }

  async cleanupPlayer(player: Player, mapId: string) {
    await this.savePlayer(player, mapId);

    this.friends.setUserOffline(player.userId);
    this.quests.removeChar(player.dbId);
    this.spatial.removeFromGrid(player);
    this.state.players.delete(player.sessionId);
  }
}
