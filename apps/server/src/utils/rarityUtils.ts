import { ItemRarity } from "@abraxas/shared";
import { ItemRarity as PrismaItemRarity } from "../generated/prisma";

const SHARED_TO_PRISMA: Record<ItemRarity, PrismaItemRarity> = {
  [ItemRarity.COMMON]: PrismaItemRarity.COMMON,
  [ItemRarity.UNCOMMON]: PrismaItemRarity.UNCOMMON,
  [ItemRarity.RARE]: PrismaItemRarity.RARE,
  [ItemRarity.EPIC]: PrismaItemRarity.EPIC,
  [ItemRarity.LEGENDARY]: PrismaItemRarity.LEGENDARY,
};

const PRISMA_TO_SHARED: Record<PrismaItemRarity, ItemRarity> = {
  [PrismaItemRarity.COMMON]: ItemRarity.COMMON,
  [PrismaItemRarity.UNCOMMON]: ItemRarity.UNCOMMON,
  [PrismaItemRarity.RARE]: ItemRarity.RARE,
  [PrismaItemRarity.EPIC]: ItemRarity.EPIC,
  [PrismaItemRarity.LEGENDARY]: ItemRarity.LEGENDARY,
};

export const toSharedRarity = (r: PrismaItemRarity | null | undefined): ItemRarity =>
  r ? PRISMA_TO_SHARED[r] ?? ItemRarity.COMMON : ItemRarity.COMMON;

export const toPrismaRarity = (r: ItemRarity | string | undefined): PrismaItemRarity =>
  r ? SHARED_TO_PRISMA[r as ItemRarity] ?? PrismaItemRarity.COMMON : PrismaItemRarity.COMMON;
