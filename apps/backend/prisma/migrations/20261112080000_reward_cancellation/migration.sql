-- Alter MemberVoucher status enum
ALTER TABLE `MemberVoucher`
  MODIFY COLUMN `status` ENUM('AVAILABLE', 'PENDING_FULFILLMENT', 'USED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'AVAILABLE';

-- Backfill only existing REWARD vouchers from AVAILABLE to PENDING_FULFILLMENT; discount vouchers remain unchanged
UPDATE `MemberVoucher`
  SET `status` = 'PENDING_FULFILLMENT'
  WHERE `snapshotType` = 'REWARD' AND `status` = 'AVAILABLE';

-- Create RewardCancellation table
CREATE TABLE `RewardCancellation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `voucherId` INT NOT NULL,
  `cancelledById` INT NOT NULL,
  `cancelledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` VARCHAR(255) NOT NULL,

  UNIQUE INDEX `RewardCancellation_voucherId_key`(`voucherId`),
  INDEX `RewardCancellation_cancelledById_idx`(`cancelledById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key constraints
ALTER TABLE `RewardCancellation`
  ADD CONSTRAINT `RewardCancellation_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `RewardCancellation_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
