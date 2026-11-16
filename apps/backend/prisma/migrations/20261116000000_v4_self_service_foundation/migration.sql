-- AlterTable
ALTER TABLE `MerchantApplication` ADD COLUMN `slug` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `categoryId` INTEGER NULL,
    ADD COLUMN `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `richDescription` TEXT NULL,
    ADD COLUMN `sku` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `StorefrontDraft` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StorefrontDraft_merchantId_key`(`merchantId`),
    INDEX `StorefrontDraft_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StorefrontConfigVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `source` ENUM('DEFAULT_INIT', 'PUBLISH', 'ROLLBACK') NOT NULL DEFAULT 'PUBLISH',
    `sourceVersionId` INTEGER NULL,
    `note` VARCHAR(255) NULL,
    `publishedById` INTEGER NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StorefrontConfigVersion_merchantId_isPublished_idx`(`merchantId`, `isPublished`),
    INDEX `StorefrontConfigVersion_merchantId_publishedAt_idx`(`merchantId`, `publishedAt`),
    INDEX `StorefrontConfigVersion_publishedById_idx`(`publishedById`),
    UNIQUE INDEX `StorefrontConfigVersion_merchantId_version_key`(`merchantId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductCategory_merchantId_sortOrder_idx`(`merchantId`, `sortOrder`),
    UNIQUE INDEX `ProductCategory_merchantId_slug_key`(`merchantId`, `slug`),
    UNIQUE INDEX `ProductCategory_merchantId_name_key`(`merchantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `merchantId` INTEGER NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `altText` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductImage_productId_sortOrder_idx`(`productId`, `sortOrder`),
    INDEX `ProductImage_merchantId_productId_idx`(`merchantId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `bannerUrl` VARCHAR(2048) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `locationName` VARCHAR(191) NOT NULL,
    `locationAddress` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MerchantEvent_merchantId_status_startAt_idx`(`merchantId`, `status`, `startAt`),
    UNIQUE INDEX `MerchantEvent_merchantId_slug_key`(`merchantId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `MerchantApplication_slug_key` ON `MerchantApplication`(`slug`);

-- CreateIndex
CREATE INDEX `Product_merchantId_categoryId_status_idx` ON `Product`(`merchantId`, `categoryId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `Product_merchantId_sku_key` ON `Product`(`merchantId`, `sku`);

-- CreateIndex
CREATE INDEX `Order_merchantId_memberId_status_idx` ON `Order`(`merchantId`, `memberId`, `status`);

-- CreateIndex
CREATE INDEX `OrderItem_productId_idx` ON `OrderItem`(`productId`);

-- AddForeignKey
ALTER TABLE `StorefrontDraft` ADD CONSTRAINT `StorefrontDraft_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StorefrontDraft` ADD CONSTRAINT `StorefrontDraft_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StorefrontConfigVersion` ADD CONSTRAINT `StorefrontConfigVersion_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StorefrontConfigVersion` ADD CONSTRAINT `StorefrontConfigVersion_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantEvent` ADD CONSTRAINT `MerchantEvent_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill primary gallery image for existing products that already have imageUrl
INSERT INTO `ProductImage` (`productId`, `merchantId`, `url`, `altText`, `sortOrder`)
SELECT `id`, `merchantId`, `imageUrl`, `name`, 0
FROM `Product`
WHERE `imageUrl` IS NOT NULL AND TRIM(`imageUrl`) <> '';
