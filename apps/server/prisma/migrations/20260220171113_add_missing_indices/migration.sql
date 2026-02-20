-- Add index on RequesterFriend.recipientId for fast "show me friend requests sent to me" queries
CREATE INDEX IF NOT EXISTS "RequesterFriend_recipientId_status_idx"
  ON "public"."RequesterFriend" ("recipientId", "status");

-- Add index on RecipientFriend.requesterId for mirror direction queries
CREATE INDEX IF NOT EXISTS "RecipientFriend_requesterId_status_idx"
  ON "public"."RecipientFriend" ("requesterId", "status");

-- Add index on ItemInstance.boundToCharacterId for fast inventory loads on login
CREATE INDEX IF NOT EXISTS "ItemInstance_boundToCharacterId_idx"
  ON "public"."ItemInstance" ("boundToCharacterId");
