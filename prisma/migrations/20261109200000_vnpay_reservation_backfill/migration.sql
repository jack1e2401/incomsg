ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotVndPerPoint` INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN `snapshotRuleActive` BOOLEAN NOT NULL DEFAULT true;

-- For pre-existing CREATED attempts, capture the available rule decision and
-- ensure a membership/wallet exists. Migration 2100 performs the single max-tier
-- reservation calculation and aborts if the pending capacity cannot fit safely.
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
SELECT pa.`id` AS `attemptId`,
       CASE WHEN lr.`vndPerPoint` > 0 THEN lr.`vndPerPoint` ELSE 10000 END AS `snapshotVndPerPoint`,
       COALESCE(lr.`isActive`, true) AS `snapshotRuleActive`
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
JOIN `LoyaltyWallet` w ON w.`membershipId` = mm.`id`
LEFT JOIN `LoyaltyRule` lr ON lr.`merchantId` = o.`merchantId`
WHERE pa.`status` = 'CREATED';

UPDATE `PaymentAttempt` pa
JOIN `VnpayReservationBackfill` backfill ON backfill.`attemptId` = pa.`id`
SET pa.`snapshotVndPerPoint` = backfill.`snapshotVndPerPoint`,
    pa.`snapshotRuleActive` = backfill.`snapshotRuleActive`;

DROP TEMPORARY TABLE `VnpayReservationBackfill`;
-- END LEGACY RESERVATION BACKFILL
