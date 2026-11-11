ALTER TABLE `PointTransaction`
    ADD COLUMN `promotedToTier` ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM') NULL;
