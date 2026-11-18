CREATE TABLE `RefreshSession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `familyId` CHAR(36) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `replacedById` INTEGER NULL,
  UNIQUE INDEX `RefreshSession_tokenHash_key` (`tokenHash`),
  UNIQUE INDEX `RefreshSession_replacedById_key` (`replacedById`),
  INDEX `RefreshSession_userId_revokedAt_expiresAt_idx` (`userId`, `revokedAt`, `expiresAt`),
  INDEX `RefreshSession_familyId_revokedAt_idx` (`familyId`, `revokedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RefreshSession`
  ADD CONSTRAINT `RefreshSession_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RefreshSession_replacedById_fkey`
    FOREIGN KEY (`replacedById`) REFERENCES `RefreshSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
