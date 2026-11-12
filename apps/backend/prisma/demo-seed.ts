import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";
import { createInventoryBalance } from "../src/modules/inventory/inventory.persistence.js";

async function main(): Promise<void> {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.pathname !== "/incomsg-test") {
    throw new Error("Demo seed requires local incomsg-test");
  }
  const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14) + randomBytes(2).toString("hex");
  const password = process.env.DEMO_PASSWORD || randomBytes(16).toString("hex");
  if (password.length < 12) throw new Error("DEMO_PASSWORD must contain at least 12 characters");
  const passwordHash = await hashPassword(password);
  const email = (role: string) => `${role}-${runId}@demo.incomsg.local`;
  const data = await prisma.$transaction(async (tx) => {
    const admin = await tx.user.create({ data: { email: email("admin"), passwordHash, role: "ADMIN" } });
    const owner = await tx.user.create({ data: {
      email: email("merchant"), passwordHash, role: "MERCHANT",
      application: { create: { storeName: "Loyalty Demo Store", status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() } },
    } });
    const member = await tx.user.create({ data: { email: email("member"), passwordHash, role: "MEMBER" } });
    const rewardMember = await tx.user.create({ data: { email: email("rewards"), passwordHash, role: "MEMBER" } });
    const merchant = await tx.merchant.create({ data: { ownerId: owner.id, name: "Loyalty Demo Store", slug: `loyalty-demo-${runId}` } });
    await tx.loyaltyRule.create({ data: { merchantId: merchant.id, vndPerPoint: 10000 } });
    await tx.loyaltyTier.createMany({ data: [
      { merchantId: merchant.id, level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
      { merchantId: merchant.id, level: "SILVER", minLifetimePoints: 100, multiplier: "1.20" },
      { merchantId: merchant.id, level: "GOLD", minLifetimePoints: 500, multiplier: "1.50" },
      { merchantId: merchant.id, level: "PLATINUM", minLifetimePoints: 1000, multiplier: "2.00" },
    ] });
    const small = await tx.product.create({ data: { merchantId: merchant.id, name: "Demo item 6,000 VND", price: "6000" } });
    const recovery = await tx.product.create({ data: { merchantId: merchant.id, name: "Debt recovery item 14,000 VND", price: "14000" } });
    const reward = await tx.product.create({ data: { merchantId: merchant.id, name: "Demo reward gift", price: "0", kind: "REWARD" } });
    const discount = await tx.voucherDefinition.create({ data: { merchantId: merchant.id, title: "Demo discount 1,000 VND", type: "DISCOUNT", pointsCost: 1, discountAmount: "1000" } });
    const rewardDefinition = await tx.voucherDefinition.create({ data: { merchantId: merchant.id, title: "Demo reward gift", type: "REWARD", pointsCost: 1, rewardProductId: reward.id, rewardDescription: "Collect at the demo store" } });
    await createInventoryBalance(tx, { merchantId: merchant.id, ownerType: "SALE_PRODUCT", productId: small.id }, 100, owner.id);
    await createInventoryBalance(tx, { merchantId: merchant.id, ownerType: "SALE_PRODUCT", productId: recovery.id }, 100, owner.id);
    await createInventoryBalance(tx, { merchantId: merchant.id, ownerType: "REWARD_PRODUCT", productId: reward.id }, 2, owner.id);
    await createInventoryBalance(tx, { merchantId: merchant.id, ownerType: "DISCOUNT_VOUCHER", voucherDefinitionId: discount.id }, 10, owner.id);
    return {
      runId,
      accounts: { admin: { id: admin.id, email: admin.email }, merchant: { id: owner.id, email: owner.email }, member: { id: member.id, email: member.email }, rewardMember: { id: rewardMember.id, email: rewardMember.email } },
      merchant: { id: merchant.id, slug: merchant.slug },
      products: { small: small.id, recovery: recovery.id },
      vouchers: { discount: discount.id, reward: rewardDefinition.id },
    };
  });
  const credentialsPath = process.env.DEMO_DATA_FILE || join(tmpdir(), "incomsg-loyalty-demo.json");
  writeFileSync(credentialsPath, JSON.stringify({ ...data, password, started: false, completed: false }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...data, credentialsPath }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
