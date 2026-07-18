-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

