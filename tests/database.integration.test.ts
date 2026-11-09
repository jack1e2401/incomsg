import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";

class RollbackTestData extends Error {}

after(async () => {
  await prisma.$disconnect();
});

test("a member starts unranked with separate zero-point wallets per merchant", async () => {
  const suffix = randomUUID();

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const [member, ownerA, ownerB] = await Promise.all([
        tx.user.create({ data: { email: `member-${suffix}@test.local`, passwordHash: "test", role: "MEMBER" } }),
        tx.user.create({ data: { email: `owner-a-${suffix}@test.local`, passwordHash: "test", role: "MERCHANT" } }),
        tx.user.create({ data: { email: `owner-b-${suffix}@test.local`, passwordHash: "test", role: "MERCHANT" } }),
      ]);

      const merchantA = await tx.merchant.create({ data: { ownerId: ownerA.id, name: "Store A", slug: `store-a-${suffix}` } });
      const merchantB = await tx.merchant.create({ data: { ownerId: ownerB.id, name: "Store B", slug: `store-b-${suffix}` } });
      const first = await tx.merchantMembership.create({
        data: { memberId: member.id, merchantId: merchantA.id, wallet: { create: {} } },
        include: { wallet: true },
      });
      const second = await tx.merchantMembership.create({
        data: { memberId: member.id, merchantId: merchantB.id, wallet: { create: {} } },
        include: { wallet: true },
      });

      assert.equal(first.tierId, null);
      assert.equal(second.tierId, null);
      assert.notEqual(first.wallet?.id, second.wallet?.id);
      assert.equal(first.wallet?.availablePoints, 0);
      assert.equal(second.wallet?.availablePoints, 0);
      assert.equal(first.wallet?.lifetimeEarnedPoints, 0);
      assert.equal(second.wallet?.lifetimeEarnedPoints, 0);

      throw new RollbackTestData();
    }),
    RollbackTestData,
  );

  assert.equal(await prisma.user.count({ where: { email: `member-${suffix}@test.local` } }), 0);
});
