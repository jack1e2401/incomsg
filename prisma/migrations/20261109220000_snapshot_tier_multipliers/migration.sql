ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotBronzeMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN `snapshotSilverMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.20,
  ADD COLUMN `snapshotGoldMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.50,
  ADD COLUMN `snapshotPlatinumMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 2.00;

-- Preserve the tier multiplier schedule for each in-flight attempt. This keeps
-- pending payments consistent with the rules shown when their URL was created.
-- BEGIN TIER MULTIPLIER SNAPSHOT BACKFILL
CREATE TEMPORARY TABLE `VnpayTierMultiplierBackfill` AS
SELECT pa.`id` AS `attemptId`, mm.`id` AS `membershipId`,
       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`bronzeMultiplier` ELSE 1.00 END AS `snapshotBronzeMultiplier`,
       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`silverMultiplier` ELSE 1.20 END AS `snapshotSilverMultiplier`,
       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`goldMultiplier` ELSE 1.50 END AS `snapshotGoldMultiplier`,
       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`platinumMultiplier` ELSE 2.00 END AS `snapshotPlatinumMultiplier`,
       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`maxMultiplier` ELSE 2.00 END AS `snapshotMaxMultiplier`,
       FLOOR(o.`total` / CASE WHEN pa.`snapshotVndPerPoint` > 0 THEN pa.`snapshotVndPerPoint` ELSE 10000 END *
             CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`maxMultiplier` ELSE 2.00 END) AS `reservedPoints`
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
LEFT JOIN (
  SELECT `merchantId`, COUNT(*) AS `tierCount`, MAX(`multiplier`) AS `maxMultiplier`,
         MAX(CASE WHEN `level` = 'BRONZE' THEN `multiplier` END) AS `bronzeMultiplier`,
         MAX(CASE WHEN `level` = 'SILVER' THEN `multiplier` END) AS `silverMultiplier`,
         MAX(CASE WHEN `level` = 'GOLD' THEN `multiplier` END) AS `goldMultiplier`,
         MAX(CASE WHEN `level` = 'PLATINUM' THEN `multiplier` END) AS `platinumMultiplier`
  FROM `LoyaltyTier` GROUP BY `merchantId`
) tierStats ON tierStats.`merchantId` = o.`merchantId`
WHERE pa.`status` = 'CREATED';

UPDATE `PaymentAttempt` pa
JOIN `VnpayTierMultiplierBackfill` backfill ON backfill.`attemptId` = pa.`id`
SET pa.`snapshotBronzeMultiplier` = backfill.`snapshotBronzeMultiplier`,
    pa.`snapshotSilverMultiplier` = backfill.`snapshotSilverMultiplier`,
    pa.`snapshotGoldMultiplier` = backfill.`snapshotGoldMultiplier`,
    pa.`snapshotPlatinumMultiplier` = backfill.`snapshotPlatinumMultiplier`,
    pa.`snapshotMaxMultiplier` = backfill.`snapshotMaxMultiplier`,
    pa.`reservedPoints` = CASE WHEN backfill.`reservedPoints` > 2147483647 THEN NULL ELSE backfill.`reservedPoints` END;

UPDATE `LoyaltyWallet` w
JOIN (
  SELECT `membershipId`, SUM(`reservedPoints`) AS `totalReserved`
  FROM `VnpayTierMultiplierBackfill` GROUP BY `membershipId`
) totals ON totals.`membershipId` = w.`membershipId`
SET w.`reservedPoints` = CASE
  WHEN totals.`totalReserved` > 2147483647
    OR w.`availablePoints` + totals.`totalReserved` > 2147483647
    OR w.`lifetimeEarnedPoints` + totals.`totalReserved` > 2147483647
  THEN NULL ELSE totals.`totalReserved` END;

DROP TEMPORARY TABLE `VnpayTierMultiplierBackfill`;
-- END TIER MULTIPLIER SNAPSHOT BACKFILL
