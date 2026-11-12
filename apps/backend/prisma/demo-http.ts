import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";

type Account = { id: number; email: string };
type DemoData = {
  runId: string; password: string; started: boolean; completed: boolean;
  accounts: Record<"admin" | "merchant" | "member" | "rewardMember", Account>;
  merchant: { id: number; slug: string }; products: { small: number; recovery: number };
  vouchers: { discount: number; reward: number }; results?: Record<string, unknown>;
};
type Wallet = { availablePoints: number; fractionalCarry: string; pointDebt: string; exactBalance: string; netLifetimeEarned: string };
const dataPath = process.env.DEMO_DATA_FILE || join(tmpdir(), "incomsg-loyalty-demo.json");
const data = JSON.parse(readFileSync(dataPath, "utf8")) as DemoData;
const baseUrl = process.env.DEMO_API_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`;
const save = () => writeFileSync(dataPath, JSON.stringify(data, null, 2), { mode: 0o600 });

async function api<T>(path: string, token?: string, method = "GET", body?: unknown, accepted = [200], key?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as T;
  assert.ok(accepted.includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}

async function login(account: Account): Promise<string> {
  const result = await api<{ accessToken: string }>("/api/auth/login", undefined, "POST", { email: account.email, password: data.password });
  return result.accessToken;
}

async function wallet(token: string, expected: [number, string, string]): Promise<Wallet> {
  const result = await api<{ wallet: Wallet }>(`/api/member/merchants/${data.merchant.id}/wallet`, token);
  assert.equal(result.wallet.availablePoints, expected[0]);
  assert.ok(new Prisma.Decimal(result.wallet.fractionalCarry).eq(expected[1]));
  assert.ok(new Prisma.Decimal(result.wallet.pointDebt).eq(expected[2]));
  return result.wallet;
}

async function order(token: string, productId: number, quantity = 1, voucherId?: number): Promise<number> {
  const result = await api<{ order: { id: number } }>("/api/orders", token, "POST", { items: [{ productId, quantity }], ...(voucherId ? { voucherId } : {}) }, [201]);
  return result.order.id;
}

async function reconcile(memberId: number, exactBalance: string, lifetime: string) {
  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: data.merchant.id } }, include: { wallet: true },
  });
  assert.ok(membership.wallet);
  const [all, earned] = await Promise.all([
    prisma.pointTransaction.aggregate({ where: { walletId: membership.wallet.id }, _sum: { delta: true }, _count: true }),
    prisma.pointTransaction.aggregate({ where: { walletId: membership.wallet.id, type: { in: ["EARN", "EARN_REVERSAL"] } }, _sum: { delta: true } }),
  ]);
  assert.ok(membership.wallet.exactBalance.eq(exactBalance));
  assert.ok(membership.wallet.netLifetimeEarned.eq(lifetime));
  assert.ok(membership.wallet.exactBalance.eq(all._sum.delta ?? "0"));
  assert.ok(membership.wallet.netLifetimeEarned.eq(earned._sum.delta ?? "0"));
  return { exactBalance: membership.wallet.exactBalance.toFixed(), netLifetimeEarned: membership.wallet.netLifetimeEarned.toFixed(), ledgerCount: all._count };
}

async function main(): Promise<void> {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) && database.pathname === "/incomsg-test");
  if (data.completed) {
    const browserMember = await prisma.user.findUnique({ where: { email: `browser-${data.runId}@demo.incomsg.local` }, select: { id: true } });
    const browserRewards = await prisma.user.findUnique({ where: { email: `browser-rewards-${data.runId}@demo.incomsg.local` }, select: { id: true } });
    console.log(JSON.stringify({
      alreadyCompleted: true,
      member: await reconcile(data.accounts.member.id, "1", "2"),
      rewardMember: await reconcile(data.accounts.rewardMember.id, "1.4", "2.4"),
      ...(browserMember ? { browserMember: await reconcile(browserMember.id, "1", "2") } : {}),
      ...(browserRewards ? { browserRewards: await reconcile(browserRewards.id, "1.4", "2.4") } : {}),
    }, null, 2));
    return;
  }
  if (data.started) throw new Error("This demo run was partially executed. Seed a new run to avoid duplicate order creation.");
  const [member, merchant, admin, rewardMember] = await Promise.all([
    login(data.accounts.member), login(data.accounts.merchant), login(data.accounts.admin), login(data.accounts.rewardMember),
  ]);
  await api("/api/admin/users", member, "GET", undefined, [403]);
  data.started = true;
  save();
  const first = await order(member, data.products.small);
  await api(`/api/orders/${first}/pay`, member, "POST");
  const firstWallet = await wallet(member, [0, "0.6", "0"]);
  const second = await order(member, data.products.small);
  await api(`/api/orders/${second}/pay`, member, "POST");
  const secondWallet = await wallet(member, [1, "0.2", "0"]);
  const key = `demo-${data.runId}-discount`;
  const redeemed = await api<{ voucher: { id: number } }>(`/api/member/vouchers/${data.vouchers.discount}/redeem`, member, "POST", undefined, [201], key);
  const replay = await api<{ voucher: { id: number } }>(`/api/member/vouchers/${data.vouchers.discount}/redeem`, member, "POST", undefined, [201], key);
  assert.equal(replay.voucher.id, redeemed.voucher.id);
  await wallet(member, [0, "0.2", "0"]);
  const preview = await api<{ walletAfter: { pointDebt: string } }>(`/api/merchant/orders/${second}/refund-preview`, merchant);
  assert.ok(new Prisma.Decimal(preview.walletAfter.pointDebt).eq("0.4"));
  const refund = await api<{ refund: { status: string } }>(`/api/merchant/orders/${second}/refund`, merchant, "POST", { reason: "Full mock refund for exact debt demo" });
  assert.equal(refund.refund.status, "COMPLETED");
  const debtWallet = await wallet(member, [0, "0", "0.4"]);
  await api(`/api/merchant/orders/${second}/refund`, merchant, "POST", { reason: "Duplicate refund request" });
  await api(`/api/member/vouchers/${data.vouchers.discount}/redeem`, member, "POST", undefined, [201], key);
  await wallet(member, [0, "0", "0.4"]);
  const third = await order(member, data.products.recovery);
  await api(`/api/orders/${third}/pay`, member, "POST");
  await api(`/api/orders/${third}/pay`, member, "POST", undefined, [200, 409]);
  const recoveredWallet = await wallet(member, [1, "0", "0"]);
  const cancelled: number[] = [];
  for (let index = 0; index < 2; index += 1) {
    const pending = await order(member, data.products.small, 1, redeemed.voucher.id);
    await api(`/api/orders/${pending}/cancel`, member, "POST");
    cancelled.push(pending);
  }

  const rewardOrder = await order(rewardMember, data.products.small, 4);
  await api(`/api/orders/${rewardOrder}/pay`, rewardMember, "POST");
  const rewardA = await api<{ voucher: { id: number } }>(`/api/member/vouchers/${data.vouchers.reward}/redeem`, rewardMember, "POST", undefined, [201], `demo-${data.runId}-reward-a`);
  await api(`/api/merchant/rewards/${rewardA.voucher.id}/cancel`, merchant, "POST", { reason: "Member cancelled gift request" });
  await api(`/api/merchant/rewards/${rewardA.voucher.id}/cancel`, merchant, "POST", { reason: "Duplicate gift cancellation" }, [409]);
  await wallet(rewardMember, [2, "0.4", "0"]);
  const rewardB = await api<{ voucher: { id: number } }>(`/api/member/vouchers/${data.vouchers.reward}/redeem`, rewardMember, "POST", undefined, [201], `demo-${data.runId}-reward-b`);
  await api(`/api/merchant/rewards/${rewardB.voucher.id}/fulfill`, merchant, "POST", { note: "Gift handed to member" });
  await wallet(rewardMember, [1, "0.4", "0"]);

  const target = data.accounts.rewardMember;
  await api(`/api/admin/users/${target.id}/status`, admin, "PATCH", { status: "SUSPENDED", reason: "Review suspected abuse" });
  await api("/api/auth/login", undefined, "POST", { email: target.email, password: data.password }, [403]);
  await api(`/api/member/merchants/${data.merchant.id}/wallet`, rewardMember, "GET", undefined, [403]);
  await api(`/api/admin/users/${target.id}/status`, admin, "PATCH", { status: "ACTIVE", reason: "Review completed" });
  const blacklist = await api<{ entry: { id: number } }>("/api/admin/email-blacklist", admin, "POST", { email: target.email, reason: "Registration and login blacklist demo" }, [201]);
  await api("/api/auth/login", undefined, "POST", { email: target.email, password: data.password }, [403]);
  await api(`/api/admin/email-blacklist/${blacklist.entry.id}/deactivate`, admin, "POST", { reason: "Appeal accepted" });
  await login(target);
  const ledger = await api<{ items: { type: string; delta: string }[] }>(`/api/merchant/loyalty/transactions?memberId=${data.accounts.member.id}`, merchant);
  assert.equal(ledger.items.length, 5);
  assert.deepEqual(ledger.items.map((entry) => entry.type).reverse(), ["EARN", "EARN", "REDEEM_DISCOUNT", "EARN_REVERSAL", "EARN"]);
  const persisted = await reconcile(data.accounts.member.id, "1", "2");
  const rewardsPersisted = await reconcile(data.accounts.rewardMember.id, "1.4", "2.4");
  data.results = { orders: { first, second, third, cancelled, rewardOrder }, vouchers: { discount: redeemed.voucher.id, cancelledReward: rewardA.voucher.id, fulfilledReward: rewardB.voucher.id }, checkpoints: { firstWallet, secondWallet, debtWallet, recoveredWallet }, persisted, rewardsPersisted };
  data.completed = true;
  save();
  console.log(JSON.stringify({ runId: data.runId, passed: true, persisted, rewardsPersisted, dataPath }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
