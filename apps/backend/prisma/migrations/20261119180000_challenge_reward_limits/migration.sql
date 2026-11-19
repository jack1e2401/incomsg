ALTER TABLE `Challenge`
  ADD COLUMN `maxRewardRecipients` INTEGER NULL,
  ADD COLUMN `rewardSlotsClaimed` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `ChallengeProgress`
  ADD COLUMN `rewardSlotClaimed` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `rewardState` ENUM('IN_PROGRESS','WAITING_BUDGET','REWARDED','LIMIT_REACHED')
    NOT NULL DEFAULT 'IN_PROGRESS';

CREATE TABLE `ChallengeLimitNotice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `challengeId` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `previousLimit` INTEGER NOT NULL,
  `newLimit` INTEGER NOT NULL,
  `actorId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ChallengeLimitNotice_challengeId_id_idx`(`challengeId`, `id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ChallengeLimitNotice_challengeId_fkey` FOREIGN KEY (`challengeId`)
    REFERENCES `Challenge`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChallengeLimitNoticeRead` (
  `noticeId` INTEGER NOT NULL,
  `memberId` INTEGER NOT NULL,
  INDEX `ChallengeLimitNoticeRead_noticeId_idx`(`noticeId`),
  PRIMARY KEY (`memberId`, `noticeId`),
  CONSTRAINT `ChallengeLimitNoticeRead_noticeId_fkey` FOREIGN KEY (`noticeId`)
    REFERENCES `ChallengeLimitNotice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ChallengeLimitNoticeRead_memberId_fkey` FOREIGN KEY (`memberId`)
    REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
