-- Stop BEFORE changing historical columns if a legacy wallet cannot reconcile.
-- Do not invent a balancing credit or rewrite old ledger entries to pass this guard.
CREATE TEMPORARY TABLE `LoyaltyExactPreflight` (`reconciled` TINYINT NOT NULL);
INSERT INTO `LoyaltyExactPreflight` (`reconciled`)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM `LoyaltyWallet` w
  LEFT JOIN (
    SELECT `walletId`, SUM(`delta`) AS `balance`,
      SUM(CASE WHEN `type` = 'EARN' THEN `delta` ELSE 0 END) AS `lifetime`
    FROM `PointTransaction` GROUP BY `walletId`
  ) ledger ON ledger.`walletId` = w.`id`
  WHERE w.`availablePoints` <> COALESCE(ledger.`balance`, 0)
    OR w.`lifetimeEarnedPoints` <> COALESCE(ledger.`lifetime`, 0)
) OR EXISTS (
  SELECT 1 FROM `Order` o LEFT JOIN `PointTransaction` p
    ON p.`orderId` = o.`id` AND p.`type` = 'EARN'
  WHERE o.`status` = 'PAID' AND p.`id` IS NULL
) THEN NULL ELSE 1 END;
DROP TEMPORARY TABLE `LoyaltyExactPreflight`;

ALTER TABLE `LoyaltyWallet`
  CHANGE COLUMN `availablePoints` `exactBalance` DECIMAL(38,12) NOT NULL DEFAULT 0,
  CHANGE COLUMN `lifetimeEarnedPoints` `netLifetimeEarned` DECIMAL(38,12) NOT NULL DEFAULT 0,
  MODIFY COLUMN `reservedPoints` DECIMAL(38,12) NOT NULL DEFAULT 0;

ALTER TABLE `PointTransaction`
  MODIFY COLUMN `delta` DECIMAL(38,12) NOT NULL,
  MODIFY COLUMN `balanceAfter` DECIMAL(38,12) NOT NULL;

ALTER TABLE `Order`
  ADD COLUMN `earnedPointsExact` DECIMAL(38,12) NULL,
  ADD COLUMN `loyaltySnapshot` JSON NULL;

UPDATE `Order` o JOIN `PointTransaction` p ON p.`orderId` = o.`id` AND p.`type` = 'EARN'
SET o.`earnedPointsExact` = p.`delta`,
    o.`loyaltySnapshot` = JSON_OBJECT('source', 'LEGACY_INTEGER_LEDGER', 'pointScale', 0);

-- Null new snapshots identify in-flight legacy attempts; preserve their prior terms.
ALTER TABLE `PaymentAttempt`
  MODIFY COLUMN `reservedPoints` DECIMAL(38,12) NOT NULL DEFAULT 0,
  ADD COLUMN `snapshotTierLevel` ENUM('BRONZE','SILVER','GOLD','PLATINUM') NULL,
  ADD COLUMN `snapshotMultiplier` DECIMAL(5,2) NULL,
  ADD COLUMN `snapshotPolicy` JSON NULL;
