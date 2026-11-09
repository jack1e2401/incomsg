import { expect, test, type Page } from "@playwright/test";

const pending = {
  id: 41,
  merchantId: 7,
  memberId: 9,
  status: "PENDING",
  subtotal: "150000",
  discountAmount: "0",
  total: "150000",
  paidAt: null,
  items: [
    { productId: 12, productName: "Demo Coffee", unitPrice: "150000", quantity: 1, lineTotal: "150000" },
  ],
};
const paid = { ...pending, status: "PAID", paidAt: "2026-11-09T10:00:00.000Z" };

async function setup(
  page: Page,
  status: () => { orderStatus: "PENDING" | "PAID"; paymentStatus: "CREATED" | "FAILED" | "SUCCEEDED" },
  onPoll: () => void,
) {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-token",
        user: { id: 9, email: "member@test.local", role: "MEMBER", isActive: true },
      }),
    ),
  );
  await page.route("**/api/member/orders/41", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ order: status().orderStatus === "PAID" ? paid : pending }),
    }),
  );
  await page.route("**/api/orders/41/payment-status", (route) => {
    const response = status();
    onPoll();
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
}

test("VNPay CREATED polling eventually refetches and displays backend PAID", async ({ page }) => {
  await page.clock.install();
  let polls = 0;
  await setup(
    page,
    () => ({
      orderStatus: polls >= 2 ? "PAID" : "PENDING",
      paymentStatus: polls >= 2 ? "SUCCEEDED" : "CREATED",
    }),
    () => polls++,
  );
  await page.goto("/member/7/orders/41?vnp_ResponseCode=00");
  await expect(page.getByText("Chờ thanh toán")).toBeVisible();
  await page.clock.runFor(6_100);
  await expect(page.getByText("Đã thanh toán")).toBeVisible();
  expect(polls).toBe(3);
});

test("VNPay FAILED is shown and allows starting a retry", async ({ page }) => {
  await page.clock.install();
  let polls = 0;
  let attempts = 0;
  await setup(
    page,
    () => ({ orderStatus: "PENDING", paymentStatus: "FAILED" }),
    () => polls++,
  );
  await page.route("**/api/orders/41/payments/vnpay", async (route) => {
    attempts++;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        orderId: 41,
        paymentUrl: "http://127.0.0.1:5194/member/7/orders/41?vnp_Retry=1",
        txnRef: `retry-${attempts}`,
      }),
    });
  });
  await page.goto("/member/7/orders/41?vnp_ResponseCode=24");
  await page.clock.runFor(2_100);
  await expect(page.getByText(/Giao dịch VNPay không thành công/)).toBeVisible();
  await page.getByRole("button", { name: "Thử thanh toán VNPay lại" }).click();
  await expect.poll(() => attempts).toBe(1);
  expect(polls).toBe(1);
});

test("VNPay timeout occurs after 30 polls and Kiểm tra lại resets and resumes polling", async ({ page }) => {
  await page.clock.install();
  let polls = 0;
  await setup(
    page,
    () => ({ orderStatus: "PENDING", paymentStatus: "CREATED" }),
    () => polls++,
  );
  await page.goto("/member/7/orders/41?vnp_ResponseCode=99");
  await page.clock.runFor(60_100);
  await expect(page.getByText(/sau 30 lần kiểm tra/)).toBeVisible();
  expect(polls).toBe(30);
  await page.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect.poll(() => polls).toBe(31);
  await page.clock.runFor(2_100);
  expect(polls).toBe(32);
});
