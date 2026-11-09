ALTER TABLE `MemberVoucher`
  ADD COLUMN `snapshotType` ENUM('DISCOUNT', 'REWARD') NULL,
  ADD COLUMN `snapshotTitle` VARCHAR(191) NULL,
  ADD COLUMN `snapshotPointsCost` INTEGER NULL,
  ADD COLUMN `snapshotDiscountAmount` DECIMAL(15, 0) NULL,
  ADD COLUMN `snapshotRewardDescription` TEXT NULL;

UPDATE `MemberVoucher` AS mv
JOIN `VoucherDefinition` AS vd ON vd.`id` = mv.`definitionId`
SET mv.`snapshotType` = vd.`type`,
    mv.`snapshotTitle` = vd.`title`,
    mv.`snapshotPointsCost` = vd.`pointsCost`,
    mv.`snapshotDiscountAmount` = vd.`discountAmount`,
    mv.`snapshotRewardDescription` = vd.`rewardDescription`;

ALTER TABLE `MemberVoucher`
  MODIFY COLUMN `snapshotType` ENUM('DISCOUNT', 'REWARD') NOT NULL,
  MODIFY COLUMN `snapshotTitle` VARCHAR(191) NOT NULL,
  MODIFY COLUMN `snapshotPointsCost` INTEGER NOT NULL;
