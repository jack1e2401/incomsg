ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotMaxMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 2.00;

-- Backfill zero-reserve legacy attempts at the configured maximum tier multiplier.
-- Preserve positive reservations from the pre-2963b9c schema. Their historical
-- multiplier/rate cannot be recovered, so set the multiplier ceiling to zero;
-- migration 2300 settles them using the exact reservedPoints fallback award.
-- As with that backfill, any signed-INT overflow aborts migration and requires
-- reconciliation of the affected pending transactions before retrying.
-- BEGIN MULTIPLIER RESERVATION BACKFILL
CREATE TEMPORARY TABLE `VnpayMultiplierBackfill` AS
SELECT pa.`id` AS `attemptId`, mm.`id` AS `membershipId`,
       CASE WHEN pa.`reservedPoints` > 0 THEN 0.00
            ELSE CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`maxMultiplier` ELSE 2.00 END
       END AS `snapshotMaxMultiplier`,
       CASE WHEN pa.`reservedPoints` > 0 THEN pa.`reservedPoints`
            ELSE FLOOR(o.`total` / CASE WHEN pa.`snapshotVndPerPoint` > 0 THEN pa.`snapshotVndPerPoint` ELSE 10000 END *
                       CASE WHEN tierStats.`tierCount` = 4 THEN tierStats.`maxMultiplier` ELSE 2.00 END)
       END AS `reservedPoints`
FROM `PaymentAttempt` pa
JOIN `Order` o ON o.`id` = pa.`orderId`
JOIN `MerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`
LEFT JOIN (
  SELECT `merchantId`, COUNT(*) AS `tierCount`, MAX(`multiplier`) AS `maxMultiplier`
  FROM `LoyaltyTier` GROUP BY `merchantId`
) tierStats ON tierStats.`merchantId` = o.`merchantId`
WHERE pa.`status` = 'CREATED';

UPDATE `PaymentAttempt` pa
JOIN `VnpayMultiplierBackfill` backfill ON backfill.`attemptId` = pa.`id`
SET pa.`snapshotMaxMultiplier` = backfill.`snapshotMaxMultiplier`,
    pa.`reservedPoints` = CASE WHEN backfill.`reservedPoints` > 2147483647 THEN NULL ELSE backfill.`reservedPoints` END;

UPDATE `LoyaltyWallet` w
JOIN (
  SELECT `membershipId`, SUM(`reservedPoints`) AS `totalReserved`
  FROM `VnpayMultiplierBackfill` GROUP BY `membershipId`
) totals ON totals.`membershipId` = w.`membershipId`
SET w.`reservedPoints` = CASE
  WHEN totals.`totalReserved` > 2147483647
    OR w.`availablePoints` + totals.`totalReserved` > 2147483647
    OR w.`lifetimeEarnedPoints` + totals.`totalReserved` > 2147483647
  THEN NULL ELSE totals.`totalReserved` END;

DROP TEMPORARY TABLE `VnpayMultiplierBackfill`;
-- END MULTIPLIER RESERVATION BACKFILL
