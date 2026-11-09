ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotVndPerPoint` INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN `snapshotRuleActive` BOOLEAN NOT NULL DEFAULT true;

-- For pre-existing CREATED attempts, reserve the maximum configured tier award,
-- even when today's rule is inactive: its original rule state is unknowable, so
-- the snapshot controls settlement while the conservative reserve protects it.
-- If legacy reservations cannot fit the signed INT wallet capacity, the NOT NULL
-- guard below aborts this migration. Reconcile those in-flight transactions with
-- VNPay before retrying; never deploy with a potentially successful zero reserve.
-- BEGIN LEGACY RESERVATION BACKFILL
INSERT IGNORE INTO `MerchantMembership` (`merchantId`, `memberId`, `createdAt`, `updatedAt`)
SELECT DISTINCT o.`merchantId`, o.`memberId`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
LEFT JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
WHERE pa.`status` = 'CREATED' AND mm.`id` IS NULL;

INSERT IGNORE INTO `LoyaltyWallet` (`membershipId`, `availablePoints`, `lifetimeEarnedPoints`, `reservedPoints`, `createdAt`, `updatedAt`)
SELECT mm.`id`, 0, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
LEFT JOIN `LoyaltyWallet` w ON w.`membershipId` = mm.`id`
WHERE pa.`status` = 'CREATED' AND w.`id` IS NULL;

CREATE TEMPORARY TABLE `VnpayReservationBackfill` AS
SELECT pa.`id` AS `attemptId`, mm.`id` AS `membershipId`,
       CASE WHEN lr.`vndPerPoint` > 0 THEN lr.`vndPerPoint` ELSE 10000 END AS `snapshotVndPerPoint`,
       COALESCE(lr.`isActive`, true) AS `snapshotRuleActive`,
       FLOOR(o.`total` / CASE WHEN lr.`vndPerPoint` > 0 THEN lr.`vndPerPoint` ELSE 10000 END *
             CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`maxMultiplier` ELSE 2.00 END) AS `reservedPoints`
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
JOIN `LoyaltyWallet` w ON w.`membershipId` = mm.`id`
LEFT JOIN `LoyaltyRule` lr ON lr.`merchantId` = o.`merchantId`
LEFT JOIN (
  SELECT `merchantId`, COUNT(*) AS `tierCount`, MAX(`multiplier`) AS `maxMultiplier`
  FROM `LoyaltyTier` GROUP BY `merchantId`
) tierStats ON tierStats.`merchantId` = o.`merchantId`
WHERE pa.`status` = 'CREATED';

UPDATE `PaymentAttempt` pa
JOIN `VnpayReservationBackfill` backfill ON backfill.`attemptId` = pa.`id`
SET pa.`snapshotVndPerPoint` = backfill.`snapshotVndPerPoint`,
    pa.`snapshotRuleActive` = backfill.`snapshotRuleActive`,
    pa.`reservedPoints` = CASE WHEN backfill.`reservedPoints` > 2147483647 THEN NULL ELSE backfill.`reservedPoints` END;

UPDATE `LoyaltyWallet` w
JOIN (
  SELECT `membershipId`, SUM(`reservedPoints`) AS `totalReserved`
  FROM `VnpayReservationBackfill` GROUP BY `membershipId`
) totals ON totals.`membershipId` = w.`membershipId`
SET w.`reservedPoints` = CASE
  WHEN totals.`totalReserved` > 2147483647
    OR w.`availablePoints` + totals.`totalReserved` > 2147483647
    OR w.`lifetimeEarnedPoints` + totals.`totalReserved` > 2147483647
  THEN NULL ELSE totals.`totalReserved` END;

DROP TEMPORARY TABLE `VnpayReservationBackfill`;
-- END LEGACY RESERVATION BACKFILL
