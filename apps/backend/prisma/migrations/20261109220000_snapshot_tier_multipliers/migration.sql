ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotBronzeMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN `snapshotSilverMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.20,
  ADD COLUMN `snapshotGoldMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.50,
  ADD COLUMN `snapshotPlatinumMultiplier` DECIMAL(5,2) NOT NULL DEFAULT 2.00;

-- Only schema changes here. Legacy per-tier terms are unavailable; migration
-- 20261109230000 uses the already-reserved snapshotMaxMultiplier fallback.
-- This migration must not rewrite snapshotMaxMultiplier, reservedPoints, or wallets.
