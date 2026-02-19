-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSlot" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "itemId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BankSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bank_characterId_key" ON "Bank"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSlot_itemId_key" ON "BankSlot"("itemId");

-- CreateIndex
CREATE INDEX "BankSlot_bankId_idx" ON "BankSlot"("bankId");

-- CreateIndex
CREATE INDEX "BankSlot_itemId_idx" ON "BankSlot"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSlot_bankId_idx_key" ON "BankSlot"("bankId", "idx");

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSlot" ADD CONSTRAINT "BankSlot_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSlot" ADD CONSTRAINT "BankSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
