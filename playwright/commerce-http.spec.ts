import { expect, test } from "@playwright/test";

const pendingOrder = {
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

async function signInAsMember(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-token",
        user: { id: 9, email: "member@test.local", role: "MEMBER", isActive: true },
      }),
    );
  });
}

test("Member discovers a real merchant and catalog from HTTP", async ({ page }) => {
  await signInAsMember(page);
  await page.route("**/api/merchants", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        merchants: [{ id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true }],
      }),
    }),
  );
  await page.route("**/api/merchants/7/products", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        products: [
          {
            id: 12,
            merchantId: 7,
            name: "Demo Coffee",
            description: "",
            imageUrl: null,
            price: "150000",
            status: "ACTIVE",
          },
        ],
      }),
    }),
  );

  await page.goto("/member");
  await page.getByRole("combobox", { name: "Cửa hàng" }).selectOption("7");
  await page.getByRole("button", { name: /Mở/ }).click();
  await expect(page.getByRole("heading", { name: "Cửa hàng #7" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo Coffee" })).toBeVisible();
});

test("checkout stays pending until the mock payment endpoint confirms PAID", async ({ page }) => {
  await signInAsMember(page);
  let paid = false;
  let orderBody: unknown;
  await page.route("**/api/merchants/7/products", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        products: [
          {
            id: 12,
            merchantId: 7,
            name: "Demo Coffee",
            description: "",
            imageUrl: null,
            price: "150000",
            status: "ACTIVE",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/member/merchants/7/vouchers", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ vouchers: [] }) }),
  );
  await page.route("**/api/orders", async (route) => {
    orderBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ order: pendingOrder }),
    });
  });
  await page.route("**/api/member/orders/41", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        order: paid ? { ...pendingOrder, status: "PAID", paidAt: "2026-11-09T10:00:00.000Z" } : pendingOrder,
      }),
    }),
  );
  await page.route("**/api/orders/41/pay", async (route) => {
    paid = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        order: { ...pendingOrder, status: "PAID", paidAt: "2026-11-09T10:00:00.000Z" },
      }),
    });
  });

  await page.goto("/member/7");
  await page.getByRole("button", { name: "Chọn mua" }).click();
  await page.getByRole("link", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /Tạo đơn chờ thanh toán/ }).click();
  await expect(page.getByText("Chờ thanh toán")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thanh toán mô phỏng" })).toBeVisible();
  expect(orderBody).toEqual({ productId: 12, quantity: 1 });
  await page.getByRole("button", { name: "Thanh toán mô phỏng" }).click();
  await expect(page.getByRole("status").getByText("Thanh toán đã được máy chủ xác nhận")).toBeVisible();
});

test("a VNPay return query never marks a pending order paid by itself", async ({ page }) => {
  await signInAsMember(page);
  await page.route("**/api/member/orders/41", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ order: pendingOrder }) }),
  );
  await page.route("**/api/orders/41/payment-status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ orderStatus: "PENDING", paymentStatus: "CREATED" }),
    }),
  );
  await page.goto("/member/7/orders/41?vnp_ResponseCode=00");
  await expect(page.getByText("Chờ thanh toán")).toBeVisible();
  await expect(page.getByRole("status").getByText("Thanh toán đã được máy chủ xác nhận")).toHaveCount(0);
});
