import { type, ArraySchema, view } from "@colyseus/schema";
import { Char } from "./Char";
import { InventoryItem } from "./InventoryItem";
import { CLASS_STATS, ABILITIES } from "@abraxas/shared";
import type { ClassType, ClassStats, Ability } from "@abraxas/shared";

export class Player extends Char {
	// ── Shared (visible to all clients) ─────────────────────────────────────
	@type("string") groupId: string = "";
	@type("string") guildId: string = "";
	@type("string") classType: ClassType = "WARRIOR";
	@type("boolean") meditating: boolean = false;
	@type("boolean") pvpEnabled: boolean = false;

	// ── Private (only visible to the owning client via StateView) ────────────

	/** Internal DB references — server-only, never synced to clients */
	userId: string = "";
	dbId: string = "";
	role: string = "USER";
	@view() @type("uint8") speedOverride: number = 0;

	/** Mana — only the local player's mana bar is rendered */
	@view() @type("int32") mana: number = 0;
	@view() @type("int32") maxMana: number = 0;

	/** Economy — no other player should see your gold */
	@view() @type("uint32") gold: number = 0;

	/** Progression — XP is private */
	@view() @type("uint8") level: number = 1;
	@view() @type("uint32") xp: number = 0;
	@view() @type("uint32") maxXp: number = 100;

	/** Inventory — only the owning client needs item contents */
	@view() @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

	/** Equipment — only the owning client's sidebar renders these */
	@view() @type("string") equipWeapon: string = "";
	@view() @type("string") equipArmor: string = "";
	@view() @type("string") equipShield: string = "";
	@view() @type("string") equipHelmet: string = "";
	@view() @type("string") equipRing: string = "";
	@view() @type("string") equipMount: string = "";

	getStats(): ClassStats {
		return CLASS_STATS[this.classType];
	}

	getAbility(abilityId: string): Ability | undefined {
		return ABILITIES[abilityId];
	}
}
