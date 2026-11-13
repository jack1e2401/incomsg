ALTER TABLE `Merchant`
  ADD COLUMN `feeTier` ENUM('BRONZE', 'SILVER', 'GOLD') NOT NULL DEFAULT 'BRONZE',
  ADD COLUMN `feeTierYear` INTEGER NULL,
  ADD COLUMN `feeTierEvaluatedAt` DATETIME(3) NULL;

CREATE INDEX `Order_merchantId_status_paidAt_idx` ON `Order` (`merchantId`, `status`, `paidAt`);

CREATE TABLE `MerchantFeeTransaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `merchantId` INTEGER NOT NULL,
  `orderId` INTEGER NOT NULL,
  `type` ENUM('FEE_CHARGE', 'FEE_REVERSAL') NOT NULL,
  `amountVnd` DECIMAL(15, 0) NOT NULL,
  `orderTotalVnd` DECIMAL(15, 0) NOT NULL,
  `tier` ENUM('BRONZE', 'SILVER', 'GOLD') NOT NULL,
  `feeRate` DECIMAL(5, 4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `eventRef` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MerchantFeeTransaction_eventRef_key` (`eventRef`),
  UNIQUE INDEX `MerchantFeeTransaction_orderId_type_key` (`orderId`, `type`),
  INDEX `MerchantFeeTransaction_merchantId_createdAt_idx` (`merchantId`, `createdAt`),
  INDEX `MerchantFeeTransaction_createdAt_idx` (`createdAt`),
  CONSTRAINT `MerchantFeeTransaction_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MerchantFeeTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
