-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('USER', 'GM', 'ADMIN');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'USER';
