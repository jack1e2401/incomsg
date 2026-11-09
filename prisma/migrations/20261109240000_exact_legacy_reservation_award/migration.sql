ALTER TABLE `PaymentAttempt`
  ADD COLUMN `snapshotExactReservationAward` BOOLEAN NOT NULL DEFAULT false;

-- Positive reservations that predate the multiplier snapshot migration use a
-- zero multiplier ceiling. They must settle at exactly the points already
-- reserved. Zero-reserve rows receive a positive configured ceiling in 2100
-- and keep their captured rule-active formula, including an inactive rule.
UPDATE `PaymentAttempt`
SET `snapshotExactReservationAward` = true
WHERE `status` = 'CREATED'
  AND `snapshotTierConfigFallback` = true
  AND `snapshotMaxMultiplier` = 0;
