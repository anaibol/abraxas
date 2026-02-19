-- CreateEnum
CREATE TYPE "CharacterClass" AS ENUM ('WARRIOR', 'MAGE', 'ROGUE', 'CLERIC', 'RANGER');

-- CreateEnum
CREATE TYPE "EquipSlot" AS ENUM ('HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS', 'WEAPON_MAIN', 'WEAPON_OFF', 'RING1', 'RING2', 'AMULET');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TURNED_IN');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequesterFriend" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequesterFriend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientFriend" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientFriend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" "CharacterClass" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "mapId" TEXT NOT NULL DEFAULT '',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "facing" TEXT NOT NULL DEFAULT 'down',

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterStats" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "str" INTEGER NOT NULL DEFAULT 5,
    "agi" INTEGER NOT NULL DEFAULT 5,
    "int" INTEGER NOT NULL DEFAULT 5,
    "maxHp" INTEGER NOT NULL DEFAULT 100,
    "maxMp" INTEGER NOT NULL DEFAULT 50,
    "hp" INTEGER NOT NULL DEFAULT 100,
    "mp" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "CharacterStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDef" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "ItemDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInstance" (
    "id" TEXT NOT NULL,
    "itemDefId" TEXT NOT NULL,
    "boundToCharacterId" TEXT,

    CONSTRAINT "ItemInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySlot" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "itemId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventorySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" "EquipSlot" NOT NULL,
    "itemId" TEXT,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterQuest" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CharacterQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RequesterFriend_requesterId_recipientId_key" ON "RequesterFriend"("requesterId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipientFriend_recipientId_requesterId_key" ON "RecipientFriend"("recipientId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_accountId_idx" ON "Character"("accountId");

-- CreateIndex
CREATE INDEX "Character_mapId_idx" ON "Character"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterStats_characterId_key" ON "CharacterStats"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDef_code_key" ON "ItemDef"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_key" ON "Inventory"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySlot_itemId_key" ON "InventorySlot"("itemId");

-- CreateIndex
CREATE INDEX "InventorySlot_inventoryId_idx" ON "InventorySlot"("inventoryId");

-- CreateIndex
CREATE INDEX "InventorySlot_itemId_idx" ON "InventorySlot"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySlot_inventoryId_idx_key" ON "InventorySlot"("inventoryId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_itemId_key" ON "Equipment"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_characterId_slot_key" ON "Equipment"("characterId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_code_key" ON "Quest"("code");

-- CreateIndex
CREATE INDEX "CharacterQuest_characterId_status_idx" ON "CharacterQuest"("characterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterQuest_characterId_questId_key" ON "CharacterQuest"("characterId", "questId");

-- AddForeignKey
ALTER TABLE "RequesterFriend" ADD CONSTRAINT "RequesterFriend_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientFriend" ADD CONSTRAINT "RecipientFriend_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStats" ADD CONSTRAINT "CharacterStats_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_itemDefId_fkey" FOREIGN KEY ("itemDefId") REFERENCES "ItemDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySlot" ADD CONSTRAINT "InventorySlot_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySlot" ADD CONSTRAINT "InventorySlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterQuest" ADD CONSTRAINT "CharacterQuest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterQuest" ADD CONSTRAINT "CharacterQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
