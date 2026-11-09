-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'MERCHANT', 'MEMBER') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` INTEGER NOT NULL,
    `storeName` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MerchantApplication_applicantId_key`(`applicantId`),
    INDEX `MerchantApplication_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Merchant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Merchant_ownerId_key`(`ownerId`),
    UNIQUE INDEX `Merchant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(15, 0) NOT NULL,
    `imageUrl` VARCHAR(2048) NULL,
    `status` ENUM('ACTIVE', 'HIDDEN') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_merchantId_status_idx`(`merchantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `subtotal` DECIMAL(15, 0) NOT NULL,
    `discountAmount` DECIMAL(15, 0) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 0) NOT NULL,
    `voucherId` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_voucherId_key`(`voucherId`),
    INDEX `Order_merchantId_status_idx`(`merchantId`, `status`),
    INDEX `Order_memberId_createdAt_idx`(`memberId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(15, 0) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotal` DECIMAL(15, 0) NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantMembership` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `tierId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MerchantMembership_merchantId_idx`(`merchantId`),
    INDEX `MerchantMembership_tierId_idx`(`tierId`),
    UNIQUE INDEX `MerchantMembership_memberId_merchantId_key`(`memberId`, `merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `level` ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM') NOT NULL,
    `minLifetimePoints` INTEGER NOT NULL,
    `multiplier` DECIMAL(5, 2) NOT NULL,

    UNIQUE INDEX `LoyaltyTier_merchantId_level_key`(`merchantId`, `level`),
    UNIQUE INDEX `LoyaltyTier_merchantId_minLifetimePoints_key`(`merchantId`, `minLifetimePoints`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `vndPerPoint` INTEGER NOT NULL DEFAULT 10000,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoyaltyRule_merchantId_key`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyWallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `membershipId` INTEGER NOT NULL,
    `availablePoints` INTEGER NOT NULL DEFAULT 0,
    `lifetimeEarnedPoints` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoyaltyWallet_membershipId_key`(`membershipId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PointTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `walletId` INTEGER NOT NULL,
    `type` ENUM('EARN', 'REDEEM_DISCOUNT', 'REDEEM_REWARD') NOT NULL,
    `delta` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `orderId` INTEGER NULL,
    `memberVoucherId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PointTransaction_orderId_key`(`orderId`),
    UNIQUE INDEX `PointTransaction_memberVoucherId_key`(`memberVoucherId`),
    INDEX `PointTransaction_walletId_createdAt_idx`(`walletId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `type` ENUM('DISCOUNT', 'REWARD') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `pointsCost` INTEGER NOT NULL,
    `discountAmount` DECIMAL(15, 0) NULL,
    `rewardDescription` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VoucherDefinition_merchantId_type_isActive_idx`(`merchantId`, `type`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberVoucher` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `membershipId` INTEGER NOT NULL,
    `definitionId` INTEGER NOT NULL,
    `status` ENUM('AVAILABLE', 'USED', 'FULFILLED') NOT NULL DEFAULT 'AVAILABLE',
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usedAt` DATETIME(3) NULL,

    INDEX `MemberVoucher_membershipId_status_idx`(`membershipId`, `status`),
    INDEX `MemberVoucher_definitionId_idx`(`definitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardFulfillment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucherId` INTEGER NOT NULL,
    `fulfilledById` INTEGER NOT NULL,
    `fulfilledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(255) NULL,

    UNIQUE INDEX `RewardFulfillment_voucherId_key`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MerchantApplication` ADD CONSTRAINT `MerchantApplication_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantApplication` ADD CONSTRAINT `MerchantApplication_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Merchant` ADD CONSTRAINT `Merchant_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantMembership` ADD CONSTRAINT `MerchantMembership_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantMembership` ADD CONSTRAINT `MerchantMembership_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantMembership` ADD CONSTRAINT `MerchantMembership_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `LoyaltyTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyTier` ADD CONSTRAINT `LoyaltyTier_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyRule` ADD CONSTRAINT `LoyaltyRule_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyWallet` ADD CONSTRAINT `LoyaltyWallet_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `MerchantMembership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `LoyaltyWallet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_memberVoucherId_fkey` FOREIGN KEY (`memberVoucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherDefinition` ADD CONSTRAINT `VoucherDefinition_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberVoucher` ADD CONSTRAINT `MemberVoucher_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `MerchantMembership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberVoucher` ADD CONSTRAINT `MemberVoucher_definitionId_fkey` FOREIGN KEY (`definitionId`) REFERENCES `VoucherDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardFulfillment` ADD CONSTRAINT `RewardFulfillment_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardFulfillment` ADD CONSTRAINT `RewardFulfillment_fulfilledById_fkey` FOREIGN KEY (`fulfilledById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
