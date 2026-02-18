/*
  Warnings:

  - You are about to drop the column `equipment` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `inventory` on the `Player` table. All the data in the column will be lost.
  - Made the column `password` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "slotIndex" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classType" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "facing" TEXT NOT NULL DEFAULT 'down',
    "hp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "mana" INTEGER NOT NULL,
    "maxMana" INTEGER NOT NULL,
    "str" INTEGER NOT NULL DEFAULT 10,
    "agi" INTEGER NOT NULL DEFAULT 10,
    "intStat" INTEGER NOT NULL DEFAULT 10,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "maxXp" INTEGER NOT NULL DEFAULT 100,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "equipWeapon" TEXT,
    "equipArmor" TEXT,
    "equipShield" TEXT,
    "equipHelmet" TEXT,
    "equipRing" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("agi", "classType", "facing", "gold", "hp", "id", "intStat", "level", "mana", "maxHp", "maxMana", "maxXp", "name", "str", "updatedAt", "userId", "x", "xp", "y") SELECT "agi", "classType", "facing", "gold", "hp", "id", "intStat", "level", "mana", "maxHp", "maxMana", "maxXp", "name", "str", "updatedAt", "userId", "x", "xp", "y" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "id", "password", "updatedAt", "username") SELECT "createdAt", "id", "password", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InventoryItem_playerId_idx" ON "InventoryItem"("playerId");
