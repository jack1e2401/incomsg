CREATE TABLE `LoyaltyPolicyVersion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `merchantId` INTEGER NOT NULL,
  `version` INTEGER NOT NULL,
  `vndPerPoint` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL,
  `tiers` JSON NOT NULL,
  `source` ENUM('MERCHANT_PUBLISH', 'LEGACY_BACKFILL') NOT NULL DEFAULT 'MERCHANT_PUBLISH',
  `publishedById` INTEGER NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LoyaltyPolicyVersion_merchantId_publishedAt_idx` (`merchantId`, `publishedAt`),
  INDEX `LoyaltyPolicyVersion_publishedById_idx` (`publishedById`),
  UNIQUE INDEX `LoyaltyPolicyVersion_merchantId_version_key` (`merchantId`, `version`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LoyaltyPolicyVersion_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LoyaltyPolicyVersion_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Order`
  ADD COLUMN `loyaltyPolicyVersionId` INTEGER NULL,
  ADD COLUMN `stockReservedAt` DATETIME(3) NULL,
  ADD COLUMN `stockReservedUntil` DATETIME(3) NULL,
  ADD COLUMN `stockReleasedAt` DATETIME(3) NULL,
  ADD INDEX `Order_loyaltyPolicyVersionId_idx` (`loyaltyPolicyVersionId`),
  ADD INDEX `Order_merchantId_status_stockReservedUntil_idx` (`merchantId`, `status`, `stockReservedUntil`),
  ADD CONSTRAINT `Order_loyaltyPolicyVersionId_fkey` FOREIGN KEY (`loyaltyPolicyVersionId`) REFERENCES `LoyaltyPolicyVersion` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MemberVoucher`
  ADD COLUMN `rewardProductIdSnapshot` INTEGER NULL,
  ADD COLUMN `rewardInventoryReserved` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD INDEX `MemberVoucher_rewardProductIdSnapshot_status_idx` (`rewardProductIdSnapshot`, `status`),
  ADD CONSTRAINT `MemberVoucher_rewardProductIdSnapshot_fkey` FOREIGN KEY (`rewardProductIdSnapshot`) REFERENCES `Product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `InventoryBalance` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `merchantId` INTEGER NOT NULL,
  `ownerType` ENUM('SALE_PRODUCT', 'REWARD_PRODUCT', 'DISCOUNT_VOUCHER') NOT NULL,
  `productId` INTEGER NULL,
  `voucherDefinitionId` INTEGER NULL,
  `onHandQuantity` INTEGER NOT NULL DEFAULT 0,
  `reservedQuantity` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `InventoryBalance_merchantId_ownerType_idx` (`merchantId`, `ownerType`),
  UNIQUE INDEX `InventoryBalance_productId_key` (`productId`),
  UNIQUE INDEX `InventoryBalance_voucherDefinitionId_key` (`voucherDefinitionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `InventoryBalance_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryBalance_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryBalance_voucherDefinitionId_fkey` FOREIGN KEY (`voucherDefinitionId`) REFERENCES `VoucherDefinition` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryBalance_quantity_check` CHECK (`onHandQuantity` >= 0 AND `reservedQuantity` >= 0 AND `reservedQuantity` <= `onHandQuantity`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryMovement` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `balanceId` INTEGER NOT NULL,
  `merchantId` INTEGER NOT NULL,
  `ownerType` ENUM('SALE_PRODUCT', 'REWARD_PRODUCT', 'DISCOUNT_VOUCHER') NOT NULL,
  `movementType` ENUM('INITIAL_STOCK', 'MANUAL_IN', 'MANUAL_OUT', 'RETURN_IN', 'ORDER_RESERVE', 'ORDER_RELEASE', 'SALE_OUT', 'REWARD_RESERVE', 'REWARD_CANCEL_RELEASE', 'REWARD_FULFILL_OUT', 'REWARD_LEGACY_RESERVE', 'VOUCHER_REDEMPTION_OUT', 'REDEMPTION_REVERSAL_IN', 'LEGACY_BACKFILL') NOT NULL,
  `quantityDelta` INTEGER NOT NULL,
  `onHandBefore` INTEGER NOT NULL,
  `onHandAfter` INTEGER NOT NULL,
  `reservedBefore` INTEGER NOT NULL,
  `reservedAfter` INTEGER NOT NULL,
  `productId` INTEGER NULL,
  `voucherDefinitionId` INTEGER NULL,
  `orderId` INTEGER NULL,
  `memberVoucherId` INTEGER NULL,
  `actorId` INTEGER NULL,
  `reason` VARCHAR(255) NOT NULL,
  `eventRef` VARCHAR(191) NOT NULL,
  `requestKey` VARCHAR(128) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `InventoryMovement_merchantId_createdAt_idx` (`merchantId`, `createdAt`),
  INDEX `InventoryMovement_productId_createdAt_idx` (`productId`, `createdAt`),
  INDEX `InventoryMovement_voucherDefinitionId_createdAt_idx` (`voucherDefinitionId`, `createdAt`),
  INDEX `InventoryMovement_orderId_idx` (`orderId`),
  INDEX `InventoryMovement_memberVoucherId_idx` (`memberVoucherId`),
  INDEX `InventoryMovement_actorId_idx` (`actorId`),
  UNIQUE INDEX `InventoryMovement_eventRef_key` (`eventRef`),
  UNIQUE INDEX `InventoryMovement_merchantId_requestKey_key` (`merchantId`, `requestKey`),
  PRIMARY KEY (`id`),
  CONSTRAINT `InventoryMovement_balanceId_fkey` FOREIGN KEY (`balanceId`) REFERENCES `InventoryBalance` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_voucherDefinitionId_fkey` FOREIGN KEY (`voucherDefinitionId`) REFERENCES `VoucherDefinition` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_memberVoucherId_fkey` FOREIGN KEY (`memberVoucherId`) REFERENCES `MemberVoucher` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_quantity_check` CHECK (
    `onHandBefore` >= 0 AND `onHandAfter` >= 0 AND `reservedBefore` >= 0 AND `reservedAfter` >= 0 AND
    `reservedBefore` <= `onHandBefore` AND `reservedAfter` <= `onHandAfter`
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `InventoryBalance` (`merchantId`, `ownerType`, `productId`, `onHandQuantity`, `reservedQuantity`, `createdAt`, `updatedAt`)
SELECT `merchantId`, IF(`kind` = 'REWARD', 'REWARD_PRODUCT', 'SALE_PRODUCT'), `id`, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Product`;

INSERT INTO `InventoryBalance` (`merchantId`, `ownerType`, `voucherDefinitionId`, `onHandQuantity`, `reservedQuantity`, `createdAt`, `updatedAt`)
SELECT `merchantId`, 'DISCOUNT_VOUCHER', `id`, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `VoucherDefinition` WHERE `type` = 'DISCOUNT';

INSERT INTO `InventoryMovement` (`balanceId`, `merchantId`, `ownerType`, `movementType`, `quantityDelta`, `onHandBefore`, `onHandAfter`, `reservedBefore`, `reservedAfter`, `productId`, `reason`, `eventRef`)
SELECT b.`id`, b.`merchantId`, b.`ownerType`, 'LEGACY_BACKFILL', 0, 0, 0, 0, 0, b.`productId`, 'Opening stock set to zero because legacy quantity was not recorded', CONCAT('inventory-backfill-product-', b.`productId`)
FROM `InventoryBalance` b WHERE b.`productId` IS NOT NULL;

INSERT INTO `InventoryMovement` (`balanceId`, `merchantId`, `ownerType`, `movementType`, `quantityDelta`, `onHandBefore`, `onHandAfter`, `reservedBefore`, `reservedAfter`, `voucherDefinitionId`, `reason`, `eventRef`)
SELECT b.`id`, b.`merchantId`, b.`ownerType`, 'LEGACY_BACKFILL', 0, 0, 0, 0, 0, b.`voucherDefinitionId`, 'Issuance capacity set to zero because legacy quantity was not recorded', CONCAT('inventory-backfill-voucher-', b.`voucherDefinitionId`)
FROM `InventoryBalance` b WHERE b.`voucherDefinitionId` IS NOT NULL;

UPDATE `MemberVoucher` mv
JOIN `VoucherDefinition` vd ON vd.`id` = mv.`definitionId`
SET mv.`rewardProductIdSnapshot` = vd.`rewardProductId`
WHERE mv.`snapshotType` = 'REWARD' AND vd.`rewardProductId` IS NOT NULL;

UPDATE `VoucherDefinition`
SET `isActive` = FALSE, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `type` = 'REWARD' AND `rewardProductId` IS NULL;

INSERT INTO `LoyaltyPolicyVersion` (`merchantId`, `version`, `vndPerPoint`, `isActive`, `tiers`, `source`, `publishedAt`)
SELECT m.`id`, 1, COALESCE(r.`vndPerPoint`, 10000), COALESCE(r.`isActive`, TRUE),
  JSON_ARRAY(
    JSON_OBJECT('level', 'BRONZE', 'minLifetimePoints', COALESCE(br.`minLifetimePoints`, 0), 'multiplier', CAST(COALESCE(br.`multiplier`, 1.00) AS CHAR)),
    JSON_OBJECT('level', 'SILVER', 'minLifetimePoints', COALESCE(si.`minLifetimePoints`, 1000), 'multiplier', CAST(COALESCE(si.`multiplier`, 1.20) AS CHAR)),
    JSON_OBJECT('level', 'GOLD', 'minLifetimePoints', COALESCE(go.`minLifetimePoints`, 5000), 'multiplier', CAST(COALESCE(go.`multiplier`, 1.50) AS CHAR)),
    JSON_OBJECT('level', 'PLATINUM', 'minLifetimePoints', COALESCE(pl.`minLifetimePoints`, 10000), 'multiplier', CAST(COALESCE(pl.`multiplier`, 2.00) AS CHAR))
  ), 'LEGACY_BACKFILL', CURRENT_TIMESTAMP(3)
FROM `Merchant` m
LEFT JOIN `LoyaltyRule` r ON r.`merchantId` = m.`id`
LEFT JOIN `LoyaltyTier` br ON br.`merchantId` = m.`id` AND br.`level` = 'BRONZE'
LEFT JOIN `LoyaltyTier` si ON si.`merchantId` = m.`id` AND si.`level` = 'SILVER'
LEFT JOIN `LoyaltyTier` go ON go.`merchantId` = m.`id` AND go.`level` = 'GOLD'
LEFT JOIN `LoyaltyTier` pl ON pl.`merchantId` = m.`id` AND pl.`level` = 'PLATINUM';
