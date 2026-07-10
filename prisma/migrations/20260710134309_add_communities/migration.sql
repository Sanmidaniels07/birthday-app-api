-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('BIRTHDAY', 'BIRTH_MONTH', 'AGE_BRACKET');

-- CreateEnum
CREATE TYPE "JoinMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "birthday_communities" (
    "id" TEXT NOT NULL,
    "type" "CommunityType" NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "bracket" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverTint" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "joinMethod" "JoinMethod" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "birthday_communities_type_month_day_bracket_key" ON "birthday_communities"("type", "month", "day", "bracket");

-- CreateIndex
CREATE INDEX "community_memberships_communityId_joinMethod_idx" ON "community_memberships"("communityId", "joinMethod");

-- CreateIndex
CREATE UNIQUE INDEX "community_memberships_userId_communityId_key" ON "community_memberships"("userId", "communityId");

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "birthday_communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
