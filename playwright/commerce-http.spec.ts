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
  await page.getByRole("link", { name: "Giỏ hàng" }).click();
  await page.getByRole("link", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /Tạo đơn chờ thanh toán/ }).click();
  await expect(page.getByText("Chờ thanh toán", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Chờ thanh toán", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").getByText("Thanh toán đã được máy chủ xác nhận")).toHaveCount(0);
});

test("a discount voucher reserved by a pending order is not selectable at checkout", async ({ page }) => {
  await signInAsMember(page);
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
  await page.route("**/api/merchants/7/vouchers", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ definitions: [] }) }),
  );
  await page.route("**/api/member/merchants/7/vouchers", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        vouchers: [
          {
            id: 8,
            definitionId: 3,
            merchantId: 7,
            memberId: 9,
            title: "Giảm 20.000đ",
            type: "DISCOUNT",
            status: "AVAILABLE",
            pointsCost: 200,
            discountAmount: "20000",
            rewardDescription: null,
            redeemedAt: "2026-11-09",
            usedAt: null,
            reserved: true,
          },
        ],
      }),
    }),
  );
  await page.route("**/api/member/merchants/7/wallet", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        wallet: {
          merchantId: 7,
          availablePoints: 0,
          lifetimeEarnedPoints: 0,
          tier: "UNRANKED",
          transactions: [],
        },
      }),
    }),
  );
  await page.goto("/member/7/vouchers");
  await expect(page.getByText("Đang giữ cho đơn chờ")).toBeVisible();
  await page.goto("/member/7");
  await page.getByRole("button", { name: "Chọn mua" }).click();
  await page.getByRole("link", { name: "Giỏ hàng" }).click();
  await page.getByRole("link", { name: "Tiếp tục" }).click();
  await expect(page.getByText(/đang được giữ bởi đơn chờ thanh toán/)).toBeVisible();
  await expect(page.getByRole("option", { name: /Giảm 20.000đ/ })).toHaveCount(0);
});

test("redeemed reward remains pending until merchant fulfillment", async ({ page }) => {
  await signInAsMember(page);
  let owned: unknown[] = [];
  await page.route("**/api/merchants/7/vouchers", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        definitions: [
          {
            id: 3,
            merchantId: 7,
            type: "REWARD",
            title: "Ly gốm tặng bạn",
            pointsCost: 500,
            discountAmount: null,
            rewardDescription: "Ly gốm thủ công",
            isActive: true,
          },
        ],
      }),
    }),
  );
  await page.route("**/api/member/merchants/7/vouchers", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ vouchers: owned }) }),
  );
  await page.route("**/api/member/merchants/7/wallet", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        wallet: {
          merchantId: 7,
          availablePoints: 1000,
          lifetimeEarnedPoints: 1000,
          tier: "GOLD",
          transactions: [],
        },
      }),
    }),
  );
  await page.route("**/api/member/vouchers/3/redeem", async (route) => {
    const voucher = {
      id: 33,
      definitionId: 3,
      merchantId: 7,
      memberId: 9,
      title: "Ly gốm tặng bạn",
      type: "REWARD",
      status: "AVAILABLE",
      pointsCost: 500,
      discountAmount: null,
      rewardDescription: "Ly gốm thủ công",
      redeemedAt: "2026-11-09",
      usedAt: null,
    };
    owned = [voucher];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ voucher, wallet: { availablePoints: 500, lifetimeEarnedPoints: 1000 } }),
    });
  });
  await page.goto("/member/7/vouchers");
  await page.getByRole("button", { name: "Đổi voucher" }).click();
  await expect(page.getByRole("status").getByText(/Đã đổi/)).toBeVisible();
  await page.getByRole("link", { name: "Quà tặng" }).click();
  await expect(page.getByText("Chờ cửa hàng trao")).toBeVisible();
  await expect(page.getByText("Đã trao")).toHaveCount(0);
});

test("admin monitoring and merchant directory render server data", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "admin-token",
        user: { id: 1, email: "admin@test.local", role: "ADMIN", isActive: true },
      }),
    ),
  );
  await page.route("**/api/admin/dashboard", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        stats: { merchants: 2, pendingApplications: 1, paidOrders: 9, totalVolume: "1234000" },
      }),
    }),
  );
  await page.route("**/api/admin/merchants", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        merchants: [{ id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true }],
      }),
    }),
  );
  await page.goto("/admin");
  await expect(page.getByText("1.234.000 ₫")).toBeVisible();
  await page.getByRole("link", { name: "Cửa hàng", exact: true }).click();
  await expect(page.getByText("moc-studio · #7")).toBeVisible();
});

test("merchant fulfillment changes a reward from pending to fulfilled only after server response", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "merchant-token",
        user: { id: 5, email: "merchant@test.local", role: "MERCHANT", isActive: true },
      }),
    ),
  );
  const reward = {
    id: 33,
    definitionId: 3,
    merchantId: 7,
    memberId: 9,
    title: "Ly gốm tặng bạn",
    type: "REWARD",
    status: "AVAILABLE",
    pointsCost: 500,
    discountAmount: null,
    rewardDescription: "Ly gốm thủ công",
    redeemedAt: "2026-11-09",
    usedAt: null,
  };
  let fulfilled = false;
  await page.route("**/api/merchant/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ merchant: { id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true } }),
    }),
  );
  await page.route("**/api/merchant/rewards", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ rewards: [{ ...reward, status: fulfilled ? "FULFILLED" : "AVAILABLE" }] }),
    }),
  );
  await page.route("**/api/merchant/rewards/33/fulfill", async (route) => {
    fulfilled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ reward: { ...reward, status: "FULFILLED" } }),
    });
  });
  await page.goto("/merchant/rewards");
  await expect(page.getByRole("button", { name: "Xác nhận đã trao" })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận đã trao" }).click();
  await expect(page.getByRole("heading", { name: "Đã trao" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xác nhận đã trao" })).toHaveCount(0);
});
