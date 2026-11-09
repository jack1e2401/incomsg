ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotTierConfigFallback` BOOLEAN NOT NULL DEFAULT false;

-- Historical tier settings are not recoverable for attempts that were already
-- CREATED at upgrade time. Preserve the maximum multiplier already reserved on
-- each attempt for every possible tier and mark that explicit fallback. This
-- migration intentionally does not change reservedPoints or LoyaltyWallet.
-- BEGIN LEGACY TIER CONFIG FALLBACK
UPDATE `PaymentAttempt`
SET `snapshotBronzeMultiplier` = `snapshotMaxMultiplier`,
    `snapshotSilverMultiplier` = `snapshotMaxMultiplier`,
    `snapshotGoldMultiplier` = `snapshotMaxMultiplier`,
    `snapshotPlatinumMultiplier` = `snapshotMaxMultiplier`,
    `snapshotTierConfigFallback` = true
WHERE `status` = 'CREATED';
-- END LEGACY TIER CONFIG FALLBACK
