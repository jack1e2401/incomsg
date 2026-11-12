-- Replace the ambiguous user active flag with an explicit account lifecycle.
ALTER TABLE `User`
  ADD COLUMN `accountStatus` ENUM('ACTIVE', 'PENDING_APPROVAL', 'REJECTED', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE';

UPDATE `User` AS u
LEFT JOIN `MerchantApplication` AS a ON a.`applicantId` = u.`id`
SET u.`accountStatus` = CASE
  WHEN a.`status` = 'PENDING' THEN 'PENDING_APPROVAL'
  WHEN a.`status` = 'REJECTED' THEN 'REJECTED'
  WHEN u.`isActive` = 0 THEN 'SUSPENDED'
  ELSE 'ACTIVE'
END;

ALTER TABLE `User`
  DROP COLUMN `isActive`;

CREATE TABLE `EmailBlacklistEntry` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastActorId` INT NOT NULL,
  `lastActorEmail` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `EmailBlacklistEntry_email_key`(`email`),
  INDEX `EmailBlacklistEntry_isActive_updatedAt_idx`(`isActive`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AdminAuditLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `actorId` INT NOT NULL,
  `actorEmail` VARCHAR(191) NOT NULL,
  `action` ENUM('USER_STATUS_CHANGED', 'EMAIL_BLACKLISTED', 'EMAIL_BLACKLIST_DEACTIVATED', 'MERCHANT_STATUS_CHANGED') NOT NULL,
  `targetType` ENUM('USER', 'EMAIL_BLACKLIST', 'MERCHANT') NOT NULL,
  `targetId` INT NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AdminAuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
  INDEX `AdminAuditLog_action_createdAt_idx`(`action`, `createdAt`),
  INDEX `AdminAuditLog_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
