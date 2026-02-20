import {
  type EquipmentData,
  type InventoryEntry,
  type NpcType,
  Direction,
  EXP_TABLE,
  ITEMS,
  STARTING_EQUIPMENT,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
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
    player.pvpKills = char.pvpKills;
    player.npcKills = char.npcKills;

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

    // Starting gear logic
    if (this.isPlayerTotallyNew(player)) {
      this.giveStartingGear(player);
    }

    // Apply equipment
    if (char.equipments) {
      for (const eq of char.equipments) {
        if (eq.item?.itemDef) {
          const invItem = new InventoryItem();
          invItem.itemId = eq.item.itemDef.code;
          switch (eq.slot) {
            case "WEAPON_MAIN":
              player.equipWeapon = invItem;
              break;
            case "WEAPON_OFF":
              player.equipShield = invItem;
              break;
            case "HEAD":
              player.equipHelmet = invItem;
              break;
            case "CHEST":
              player.equipArmor = invItem;
              break;
            case "RING1":
              player.equipRing = invItem;
              break;
            case "MOUNT":
              player.equipMount = invItem;
              break;
          }
        }
      }
      this.inventorySystem.recalcStats(player);
      player.hp = Math.min(player.hp, player.maxHp);
      player.mana = Math.min(player.mana, player.maxMana);
    }

    // Set alive AFTER stats/equipment are fully resolved so hp reflects
    // the real post-recalc value (fixes spawn-dead bug).
    player.alive = player.hp > 0;

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
          // Find the item in the inventory to get its slotIndex
          const item = player.inventory.find(i => i.itemId === itemId);
          if (item) {
            this.inventorySystem.equipItem(player, item.itemId);
          }
        }
      }
      this.inventorySystem.recalcStats(player);
      player.hp = player.maxHp;
      player.mana = player.maxMana;
    }
  }

  async savePlayer(
    player: Player,
    mapId: string,
    activeCompanions: { type: string; level: number; exp: number; hp: number }[] = [],
  ) {
    const inventory: InventoryEntry[] = [];
    player.inventory.forEach((item) => {
      inventory.push({
        itemId: item.itemId,
        quantity: item.quantity,
        slotIndex: item.slotIndex,
        rarity: item.rarity as any,
        affixes: Array.from(item.affixes).map(a => ({ type: a.affixType, stat: a.stat, value: a.value })) as any,
      });
    });

    const equipment: EquipmentData = {
      weapon: player.equipWeapon?.itemId || "",
      shield: player.equipShield?.itemId || "",
      helmet: player.equipHelmet?.itemId || "",
      armor: player.equipArmor?.itemId || "",
      ring: player.equipRing?.itemId || "",
      mount: player.equipMount?.itemId || "",
    };

    const saveData = {
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
      companions: activeCompanions,
      pvpKills: player.pvpKills,
      npcKills: player.npcKills,
    };

    await PersistenceService.saveChar(player.dbId, saveData);
  }

  async cleanupPlayer(
    player: Player,
    mapId: string,
    activeCompanions: { type: string; level: number; exp: number; hp: number }[] = [],
  ) {
    await this.savePlayer(player, mapId, activeCompanions);

    this.friends.setUserOffline(player.userId);
    this.quests.removeChar(player.dbId);
    this.spatial.removeFromGrid(player);
    this.state.players.delete(player.sessionId);
  }
}
