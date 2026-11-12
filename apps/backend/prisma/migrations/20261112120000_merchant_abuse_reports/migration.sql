CREATE TABLE `MerchantAbuseReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `reporterId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MerchantAbuseReport_merchantId_createdAt_idx`(`merchantId`, `createdAt`),
    INDEX `MerchantAbuseReport_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `MerchantAbuseReport_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `MerchantAbuseReport_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `MerchantAbuseReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `MerchantAbuseReport_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `MerchantAbuseReport_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
