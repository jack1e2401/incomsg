-- Alter PointTransaction type enum to include reversals
ALTER TABLE `PointTransaction`
  MODIFY COLUMN `type` ENUM('EARN', 'REDEEM_DISCOUNT', 'REDEEM_REWARD', 'EARN_REVERSAL', 'REDEMPTION_REVERSAL') NOT NULL;

-- Add eventRef, source, and actorId to PointTransaction
ALTER TABLE `PointTransaction`
  ADD COLUMN `eventRef` VARCHAR(191) NULL,
  ADD COLUMN `source` ENUM('MOCK_PAYMENT', 'VNPAY_IPN', 'MEMBER_REDEMPTION', 'MERCHANT_REFUND', 'MERCHANT_REWARD_CANCELLATION', 'ADMIN_ADJUSTMENT', 'LEGACY_BACKFILL', 'SYSTEM') NOT NULL DEFAULT 'LEGACY_BACKFILL',
  ADD COLUMN `actorId` INT NULL;

-- Backfill eventRef for historical rows
UPDATE `PointTransaction`
SET `eventRef` = CASE
  WHEN `orderId` IS NOT NULL THEN CONCAT('legacy-order-', `orderId`)
  WHEN `memberVoucherId` IS NOT NULL THEN CONCAT('legacy-voucher-', `memberVoucherId`)
  ELSE CONCAT('legacy-tx-', `id`)
END
WHERE `eventRef` IS NULL;

-- Make eventRef NOT NULL and add uniqueness + indexes
ALTER TABLE `PointTransaction`
  MODIFY COLUMN `eventRef` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `PointTransaction_eventRef_key` ON `PointTransaction`(`eventRef`);
CREATE INDEX `PointTransaction_actorId_idx` ON `PointTransaction`(`actorId`);

-- In MySQL, foreign key constraints on memberVoucherId and orderId require an index.
-- Add non-unique replacement indexes BEFORE dropping the unique constraints.
CREATE INDEX `PointTransaction_memberVoucherId_idx` ON `PointTransaction`(`memberVoucherId`);
CREATE INDEX `PointTransaction_orderId_idx` ON `PointTransaction`(`orderId`);

DROP INDEX `PointTransaction_memberVoucherId_key` ON `PointTransaction`;
DROP INDEX `PointTransaction_orderId_key` ON `PointTransaction`;

-- Create RedemptionIdempotency table
CREATE TABLE `RedemptionIdempotency` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `route` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `requestHash` VARCHAR(64) NOT NULL,
  `definitionId` INT NOT NULL,
  `voucherId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `RedemptionIdempotency_memberId_idx`(`memberId`),
  INDEX `RedemptionIdempotency_voucherId_idx`(`voucherId`),
  UNIQUE INDEX `RedemptionIdempotency_memberId_route_idempotencyKey_key`(`memberId`, `route`, `idempotencyKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
