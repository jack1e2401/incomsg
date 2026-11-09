CREATE TABLE `PaymentAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `txnRef` VARCHAR(100) NOT NULL,
    `expectedAmount` DECIMAL(15,0) NOT NULL,
    `status` ENUM('CREATED', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'CREATED',
    `transactionNo` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    UNIQUE INDEX `PaymentAttempt_orderId_key`(`orderId`),
    UNIQUE INDEX `PaymentAttempt_txnRef_key`(`txnRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
