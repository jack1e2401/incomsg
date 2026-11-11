ALTER TABLE `Product`
  ADD COLUMN `kind` ENUM('SALE', 'REWARD') NOT NULL DEFAULT 'SALE';

ALTER TABLE `VoucherDefinition`
  ADD COLUMN `rewardProductId` INTEGER NULL;

CREATE INDEX `VoucherDefinition_rewardProductId_idx` ON `VoucherDefinition` (`rewardProductId`);

ALTER TABLE `VoucherDefinition`
  ADD CONSTRAINT `VoucherDefinition_rewardProductId_fkey`
  FOREIGN KEY (`rewardProductId`) REFERENCES `Product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
