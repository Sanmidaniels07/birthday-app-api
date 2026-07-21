-- AlterEnum
ALTER TYPE "CommunityType" ADD VALUE 'ANNIVERSARY';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "showAnniversary" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anniversaryDay" INTEGER,
ADD COLUMN     "anniversaryMonth" INTEGER;

-- CreateIndex
CREATE INDEX "users_anniversaryMonth_anniversaryDay_idx" ON "users"("anniversaryMonth", "anniversaryDay");
