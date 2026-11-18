CREATE TABLE `ChallengeMilestone` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `challengeId` INTEGER NOT NULL,
  `position` INTEGER NOT NULL,
  `thresholdValue` DECIMAL(15, 0) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `description` VARCHAR(240) NOT NULL,
  UNIQUE INDEX `ChallengeMilestone_challengeId_position_key` (`challengeId`, `position`),
  UNIQUE INDEX `ChallengeMilestone_challengeId_thresholdValue_key` (`challengeId`, `thresholdValue`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ChallengeMilestone`
  ADD CONSTRAINT `ChallengeMilestone_challengeId_fkey`
  FOREIGN KEY (`challengeId`) REFERENCES `Challenge`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
