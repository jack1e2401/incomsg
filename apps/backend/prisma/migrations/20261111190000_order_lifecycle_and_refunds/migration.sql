-- Alter Order status enum
ALTER TABLE `Order`
  MODIFY COLUMN `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'PENDING';

-- In MySQL, foreign key on Order(voucherId) requires an index.
-- Add non-unique index before dropping the unique constraint.
CREATE INDEX `Order_voucherId_idx` ON `Order`(`voucherId`);

-- Drop unique index on Order(voucherId)
DROP INDEX `Order_voucherId_key` ON `Order`;

-- Create OrderVoucherReservation table
CREATE TABLE `OrderVoucherReservation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `voucherId` INT NOT NULL,
  `orderId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `OrderVoucherReservation_voucherId_key`(`voucherId`),
  UNIQUE INDEX `OrderVoucherReservation_orderId_key`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill existing PENDING order reservations
INSERT INTO `OrderVoucherReservation` (`voucherId`, `orderId`, `createdAt`)
SELECT `voucherId`, `id`, `createdAt`
FROM `Order`
WHERE `status` = 'PENDING' AND `voucherId` IS NOT NULL;

-- Create OrderRefund table
CREATE TABLE `OrderRefund` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `status` ENUM('PENDING_PROVIDER', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING_PROVIDER',
  `amountVnd` DECIMAL(15, 0) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `requestedById` INT NOT NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `providerReference` VARCHAR(191) NULL,

  UNIQUE INDEX `OrderRefund_orderId_key`(`orderId`),
  INDEX `OrderRefund_requestedById_idx`(`requestedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key constraints with ON DELETE CASCADE
ALTER TABLE `OrderVoucherReservation`
  ADD CONSTRAINT `OrderVoucherReservation_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderVoucherReservation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrderRefund`
  ADD CONSTRAINT `OrderRefund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderRefund_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
