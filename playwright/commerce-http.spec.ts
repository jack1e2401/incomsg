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

test("repeated adds and different products checkout as one pending order", async ({ page }) => {
  await signInAsMember(page);
  const products = [
    { id: 12, merchantId: 7, name: "Demo Coffee", price: "150000" },
    { id: 13, merchantId: 7, name: "Demo Cake", price: "25000" },
  ].map((product) => ({ ...product, description: null, imageUrl: null, kind: "SALE", status: "ACTIVE" }));
  const order = {
    ...pendingOrder,
    subtotal: "325000",
    total: "325000",
    items: [
      { ...pendingOrder.items[0], quantity: 2, lineTotal: "300000" },
      { productId: 13, productName: "Demo Cake", unitPrice: "25000", quantity: 1, lineTotal: "25000" },
    ],
  };
  await page.route("**/api/merchants/7/products", (route) => route.fulfill({ json: { products } }));
  await page.route("**/api/member/merchants/7/vouchers", (route) => route.fulfill({ json: { vouchers: [] } }));
  await page.route("**/api/member/orders/41", (route) => route.fulfill({ json: { order } }));
  await page.route("**/api/orders", (route) => route.fulfill({ status: 201, json: { order } }));

  await page.goto("/member/7");
  const addButtons = page.getByRole("button", { name: "Chọn mua" });
  await addButtons.nth(0).click();
  await page.getByRole("link", { name: "Chi tiết" }).first().click();
  await addButtons.click();
  await page.getByRole("link", { name: "Gian hàng" }).click();
  await addButtons.nth(1).click();
  const cartLink = page.getByRole("link", { name: /^Giỏ hàng/ });
  await expect(cartLink).toHaveAccessibleName("Giỏ hàng, 3 sản phẩm");
  await cartLink.click();
  await page.reload();
  await expect(page.getByRole("spinbutton").nth(0)).toHaveValue("2");
  await expect(page.getByRole("spinbutton").nth(1)).toHaveValue("1");

  await page.getByRole("link", { name: "Tiếp tục" }).click();
  await expect(page.getByText("Demo Coffee", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo Cake", { exact: true })).toBeVisible();
  const request = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/orders"));
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  expect((await request).postDataJSON()).toEqual({
    items: [{ productId: 12, quantity: 2 }, { productId: 13, quantity: 1 }],
  });
  await expect(page.getByText("Chờ thanh toán", { exact: true })).toBeVisible();
  await cartLink.click();
  await expect(page.getByText("Giỏ hàng trống", { exact: true })).toBeVisible();
});

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

test("Member cart quantity survives reload and stays separate by account and store", async ({ page }) => {
  async function useMemberSession(id: number, path: string) {
    await page.evaluate((memberId) => {
      sessionStorage.setItem(
        "loyalty.m2.session",
        JSON.stringify({
          accessToken: "member-token",
          user: { id: memberId, email: `member${memberId}@test.local`, role: "MEMBER", isActive: true },
        }),
      );
    }, id);
    await page.goto(path);
  }

  await page.route("**/api/merchants/7/products", (route) =>
    route.fulfill({
      json: {
        products: [
          {
            id: 12,
            merchantId: 7,
            name: "Demo Coffee",
            description: null,
            imageUrl: null,
            price: "150000",
            status: "ACTIVE",
          },
        ],
      },
    }),
  );
  await page.goto("/login");
  await useMemberSession(9, "/member/7");
  const cartLink = page.getByRole("link", { name: "Giỏ hàng" });
  await page.getByRole("button", { name: "Chọn mua" }).click();
  await expect(cartLink.getByText("1", { exact: true })).toBeVisible();
  await cartLink.click();
  const quantity = page.getByRole("spinbutton", { name: "Số lượng" });
  await quantity.fill("3");
  await expect(cartLink.getByText("3", { exact: true })).toBeVisible();

  await page.reload();
  await expect(quantity).toHaveValue("3");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cartLink.getByText("3", { exact: true })).toBeVisible();

  await page.goto("/member/8/cart");
  await expect(page.getByText("Giỏ hàng trống", { exact: true })).toBeVisible();
  await expect(cartLink.getByText("3", { exact: true })).toHaveCount(0);
  await page.goto("/member/7/cart");
  await expect(quantity).toHaveValue("3");

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await useMemberSession(10, "/member/7/cart");
  await expect(page.getByText("Giỏ hàng trống", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await useMemberSession(9, "/member/7/cart");
  await expect(quantity).toHaveValue("3");

  await page.getByRole("button", { name: "Bỏ sản phẩm" }).click();
  await page.reload();
  await expect(page.getByText("Giỏ hàng trống", { exact: true })).toBeVisible();
  await expect(cartLink.getByText("3", { exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await expect(page.getByText("Chờ thanh toán", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thanh toán thử" })).toBeVisible();
  expect(orderBody).toEqual({ productId: 12, quantity: 1 });
  await page.getByRole("button", { name: "Thanh toán thử" }).click();
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
  await page.getByRole("button", { name: "Đổi quà", exact: true }).click();
  await expect(page.getByRole("status").getByText(/Đã đổi/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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

test("Merchant orders show the backend's voucher discount and order status", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "merchant-token",
        user: { id: 5, email: "merchant@test.local", role: "MERCHANT", isActive: true },
      }),
    ),
  );
  await page.route("**/api/merchant/me", (route) =>
    route.fulfill({ json: { merchant: { id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true } } }),
  );
  await page.route("**/api/merchant/rewards", (route) => route.fulfill({ json: { rewards: [] } }));
  const discountedOrder = { ...pendingOrder, discountAmount: "5000", total: "145000" };
  await page.route("**/api/merchant/orders", (route) =>
    route.fulfill({
      json: {
        orders: [
          { ...discountedOrder, status: "PAID", paidAt: "2026-11-09T10:00:00.000Z" },
          { ...discountedOrder, id: 42 },
          { ...pendingOrder, id: 43 },
        ],
      },
    }),
  );

  await page.goto("/merchant/orders");
  const orderCard = (id: number) =>
    page.getByRole("heading", { name: `Đơn #${id}`, exact: true }).locator("xpath=../../..");
  await expect(orderCard(41).getByText("Voucher giảm giá", { exact: true })).toBeVisible();
  await expect(orderCard(41).getByText("Tạm tính", { exact: true })).toBeVisible();
  await expect(orderCard(41).getByText(/150\.000\s*₫/)).toBeVisible();
  await expect(orderCard(41).getByText(/−5\.000\s*₫/)).toBeVisible();
  await expect(orderCard(41).getByText(/145\.000\s*₫/)).toBeVisible();
  await expect(orderCard(41).getByText("Đã thanh toán", { exact: true })).toBeVisible();
  await expect(orderCard(42).getByText("Voucher giảm giá", { exact: true })).toBeVisible();
  await expect(orderCard(42).getByText("Chờ thanh toán", { exact: true })).toBeVisible();
  await expect(orderCard(43).getByText("Voucher giảm giá", { exact: true })).toHaveCount(0);
});

test("Merchant creates a reward product and selects it in the gift voucher form", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "merchant-token",
        user: { id: 5, email: "merchant@test.local", role: "MERCHANT", isActive: true },
      }),
    );
  });
  await page.route("**/api/merchant/me", (route) =>
    route.fulfill({ json: { merchant: { id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true } } }),
  );
  const product = {
    id: 53,
    merchantId: 7,
    name: "Ly gốm",
    description: null,
    imageUrl: null,
    kind: "REWARD",
    price: "0",
    status: "ACTIVE",
  };
  let productInput: unknown;
  let voucherInput: unknown;
  await page.route("**/api/merchant/products", async (route) => {
    if (route.request().method() === "POST") {
      productInput = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { product } });
      return;
    }
    await route.fulfill({
      json: {
        products: [
          { ...product, id: 51, name: "Cà phê bán", kind: "SALE", price: "15000" },
          { ...product, id: 52, name: "Quà đã ẩn", status: "HIDDEN" },
          ...(productInput ? [product] : []),
        ],
      },
    });
  });
  await page.route("**/api/merchant/vouchers", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      voucherInput = input;
      await route.fulfill({
        status: 201,
        json: {
          definition: { ...input, id: 62, merchantId: 7, isActive: true, rewardDescription: product.name },
        },
      });
      return;
    }
    await route.fulfill({ json: { definitions: [] } });
  });

  await page.goto("/merchant/products");
  await page.getByRole("button", { name: "Thêm sản phẩm" }).click();
  await page.getByRole("combobox", { name: "Loại sản phẩm" }).selectOption("REWARD");
  await expect(page.getByRole("textbox", { name: "Giá (VND)" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Tên sản phẩm" }).fill(product.name);
  await page.getByRole("button", { name: "Lưu sản phẩm" }).click();
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  expect(productInput).toEqual({ name: "Ly gốm", kind: "REWARD", description: null, imageUrl: null });

  await page.goto("/merchant/vouchers");
  const type = page.getByRole("combobox", { name: "Loại voucher" });
  const title = page.getByRole("textbox", { name: "Tên voucher" });
  const points = page.getByRole("spinbutton", { name: "Điểm cần đổi" });
  const amount = page.getByRole("textbox", { name: "Số tiền giảm (VND)" });
  const rewardProduct = page.getByRole("combobox", { name: "Sản phẩm đổi thưởng" });
  const create = page.getByRole("button", { name: "Tạo voucher", exact: true });

  await expect(type).toHaveValue("");
  await expect(title).toHaveCount(0);
  await expect(points).toHaveCount(0);
  await expect(create).toHaveCount(0);

  await type.selectOption("DISCOUNT");
  await expect(title).toBeVisible();
  await expect(points).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(rewardProduct).toHaveCount(0);
  await expect(create).toBeVisible();

  await type.selectOption("REWARD");
  await expect(rewardProduct).toBeVisible();
  await expect(amount).toHaveCount(0);
  await expect(create).toBeDisabled();
  await rewardProduct.selectOption(String(product.id));
  await expect(rewardProduct.locator("option:not([value=''])")).toHaveCount(1);
  await title.fill("Đổi ly gốm");
  await points.fill("50");
  await create.click();
  await expect(page.getByRole("heading", { name: "Đổi ly gốm" })).toBeVisible();
  expect(voucherInput).toEqual({
    type: "REWARD",
    title: "Đổi ly gốm",
    pointsCost: 50,
    discountAmount: null,
    rewardProductId: product.id,
  });
});

test("Merchant manages purchases and reward fulfillment from the same orders page", async ({ page }) => {
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
  await page.route("**/api/merchant/orders", (route) => route.fulfill({ json: { orders: [pendingOrder] } }));
  await page.route("**/api/merchant/rewards", (route) =>
    route.fulfill({ json: { rewards: [{ ...reward, status: fulfilled ? "FULFILLED" : "AVAILABLE" }] } }),
  );
  await page.route("**/api/merchant/rewards/33/fulfill", async (route) => {
    fulfilled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ reward: { ...reward, status: "FULFILLED" } }),
    });
  });
  await page.goto("/merchant/rewards");
  await expect(page).toHaveURL("/merchant/orders");
  await expect(page.getByRole("link", { name: "Trao thưởng", exact: true })).toHaveCount(0);
  const purchases = page.getByRole("region", { name: "Đơn mua hàng" });
  const rewards = page.getByRole("region", { name: "Quà đổi thưởng" });
  await expect(purchases.getByRole("heading", { name: "Đơn #41" })).toBeVisible();
  await expect(rewards.getByRole("heading", { name: reward.title })).toBeVisible();
  await expect(rewards.getByText(/Đổi bằng 500 điểm/)).toBeVisible();
  await expect(rewards.getByText("Chờ trao", { exact: true })).toBeVisible();
  await rewards.getByRole("button", { name: "Xác nhận đã trao" }).click();
  await expect(rewards.getByRole("heading", { name: "Đã trao" })).toBeVisible();
  await expect(rewards.getByRole("button", { name: "Xác nhận đã trao" })).toHaveCount(0);
  await expect(purchases.getByRole("heading", { name: "Đơn #41" })).toBeVisible();
  await page.reload();
  await expect(rewards.getByRole("heading", { name: "Đã trao" })).toBeVisible();
  await expect(rewards.getByRole("heading", { name: reward.title })).toBeVisible();
  await expect(rewards.getByRole("button", { name: "Xác nhận đã trao" })).toHaveCount(0);
});
