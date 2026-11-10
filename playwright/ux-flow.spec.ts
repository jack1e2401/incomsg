import { expect, test } from "@playwright/test";

test("landing uses local editorial imagery without filler labels at desktop and mobile", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const heroImage = page.getByRole("img", { name: "Gốm thủ công trong một cửa hàng độc lập" });
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("src", /\/images\/.*\.(jpg|webp)$/);
    await expect(page.locator("body")).not.toContainText(/demo mode|mock api|milestone 2|backend api/i);

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `landing overflow at ${viewport.width}px`).toBe(false);
    await page.screenshot({ path: `test-results/landing-${viewport.width}.png`, fullPage: true });
  }
});

test("authentication screens stay focused and reuse local photo art", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, heading] of [
    ["/login", "Đăng nhập"],
    ["/register", "Tạo tài khoản"],
    ["/application/status", "Trạng thái hồ sơ Merchant"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator('img[src="/images/independent-cafe.jpg"]')).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/MILESTONE 2|COMMERCE PLATFORM|Backend API/i);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("Admin review shows only application fields supplied by the backend", async ({ page }) => {
  await page.route("**/api/admin/merchants/history", (route) =>
    route.fulfill({ json: { applications: [] } }),
  );
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "admin-token",
        user: { id: 1, email: "admin@test.local", role: "ADMIN", isActive: true },
      }),
    );
  });
  await page.route("**/api/admin/merchants/pending", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        applications: [
          {
            id: 42,
            applicantId: 9,
            storeName: "Nhà Mây",
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
          },
        ],
      }),
    }),
  );

  await page.goto("/admin/applications");
  await expect(page.getByRole("heading", { name: "Duyệt hồ sơ cửa hàng" })).toBeVisible();
  const queue = page.getByRole("region", { name: "Danh sách hồ sơ" });
  const application = queue.getByRole("listitem");
  await expect(application.getByRole("heading", { name: "Nhà Mây", exact: true })).toBeVisible();
  await expect(application.getByText("#9", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/milestone|backend api|mock api/i);
  await page.screenshot({ path: "test-results/admin-review-desktop.png", fullPage: true });
});

test("Member wallet shows backend balances in a visible card without invented tier thresholds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-token",
        user: { id: 12, email: "member@test.local", role: "MEMBER", isActive: true },
      }),
    );
  });
  await page.route("**/api/member/merchants/7/wallet", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        wallet: {
          merchantId: 7,
          availablePoints: 1240,
          lifetimeEarnedPoints: 1840,
          tier: "SILVER",
          transactions: [
            {
              id: 1,
              type: "EARN",
              delta: 31,
              balanceAfter: 1240,
              reason: "Mua hàng",
              orderId: 42,
              memberVoucherId: null,
              createdAt: "2026-11-08T08:00:00.000Z",
            },
          ],
        },
      }),
    }),
  );

  await page.goto("/member/7/wallet");
  await expect(page.getByRole("heading", { name: "Điểm thưởng" })).toBeVisible();
  await expect(page.getByText(/^1\.240/)).toBeVisible();
  await expect(page.getByText("1.840", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SILVER" })).toBeVisible();
  await expect(page.getByText(/hạng dựa trên tổng điểm đã tích lũy/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cách tính điểm Loyalty" })).toBeVisible();
  await expect(page.getByText(/tiền thực trả sau giảm giá ÷ mức VND cho 1 điểm/)).toBeVisible();

  const balanceCard = page.getByText("Điểm có thể sử dụng", { exact: true }).locator("..");
  await expect
    .poll(() => balanceCard.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(47, 88, 58)");
  await page.screenshot({ path: "test-results/member-wallet-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(mobileOverflow).toBe(false);
  await page.screenshot({ path: "test-results/member-wallet-mobile.png", fullPage: true });
});

test("Member voucher catalog stays responsive and keeps voucher state as plain text", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-token",
        user: { id: 12, email: "member@test.local", role: "MEMBER", isActive: true },
      }),
    );
  });
  await page.route("**/api/merchants/7/vouchers", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        definitions: [
          {
            id: 21,
            merchantId: 7,
            type: "DISCOUNT",
            title: "Giảm 20.000đ",
            pointsCost: 200,
            discountAmount: "20000",
            rewardDescription: null,
            isActive: true,
          },
        ],
      }),
    }),
  );
  await page.route("**/api/member/merchants/7/vouchers", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        vouchers: [
          {
            id: 30,
            definitionId: 22,
            merchantId: 7,
            memberId: 12,
            title: "Một ly cà phê",
            type: "REWARD",
            status: "AVAILABLE",
            pointsCost: 150,
            discountAmount: null,
            rewardDescription: "Cà phê rang xay",
            redeemedAt: "2026-11-08T08:00:00.000Z",
            usedAt: null,
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
          availablePoints: 1240,
          lifetimeEarnedPoints: 1840,
          tier: "SILVER",
          transactions: [],
        },
      }),
    }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/member/7/vouchers");
  await expect(page.getByRole("heading", { name: "Voucher", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Giảm 20.000đ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Một ly cà phê" })).toBeVisible();
  await expect(page.getByText("Chờ cửa hàng trao")).not.toHaveClass(/rounded-full/);
  await page.screenshot({ path: "test-results/member-vouchers-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/member-vouchers-mobile.png", fullPage: true });
});

test("Merchant store previews the public catalog and the configured loyalty rules", async ({ page }) => {
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
    route.fulfill({ json: { merchant: { id: 5, name: "Mộc Studio", slug: "moc-studio", isActive: true } } }),
  );
  await page.route("**/api/merchants/5/products", (route) =>
    route.fulfill({
      json: {
        products: [
          {
            id: 101,
            merchantId: 5,
            name: "Tách men xanh",
            description: null,
            imageUrl: null,
            kind: "SALE",
            price: "180000",
            status: "ACTIVE",
          },
          {
            id: 102,
            merchantId: 5,
            name: "Đĩa gốm",
            description: null,
            imageUrl: null,
            kind: "SALE",
            price: "220000",
            status: "ACTIVE",
          },
        ],
      },
    }),
  );
  await page.route("**/api/merchant/loyalty", (route) =>
    route.fulfill({
      json: {
        config: {
          merchantId: 5,
          vndPerPoint: 12500,
          isActive: true,
          tiers: [
            { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
            { level: "SILVER", minLifetimePoints: 750, multiplier: "1.25" },
            { level: "GOLD", minLifetimePoints: 2500, multiplier: "1.50" },
            { level: "PLATINUM", minLifetimePoints: 5000, multiplier: "2.00" },
          ],
        },
      },
    }),
  );

  await page.goto("/merchant/store");
  const catalog = page.getByRole("region", { name: "Gian hàng khách nhìn thấy" });
  await expect(catalog.getByRole("heading", { name: "Tách men xanh" })).toBeVisible();
  await expect(catalog.getByText(/180\.000\s*₫/)).toBeVisible();
  await expect(catalog.getByRole("link", { name: "Quản lý sản phẩm" })).toHaveAttribute("href", "/merchant/products");

  const loyalty = page.getByRole("region", { name: "Chương trình loyalty" });
  await expect(loyalty.getByText(/12\.500\s*₫/)).toBeVisible();
  const silver = loyalty.getByRole("listitem").filter({ hasText: "Silver" });
  await expect(silver).toContainText("750 điểm");
  await expect(silver).toContainText("1,25×");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Merchant product workspace uses backend data and plain status text", async ({ page }) => {
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
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        merchant: { id: 5, name: "Mộc Studio", slug: "moc-studio", isActive: true },
      }),
    }),
  );
  await page.route("**/api/merchant/products", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        products: [
          {
            id: 101,
            merchantId: 5,
            name: "Tách men xanh",
            description: "Gốm thủ công",
            imageUrl: null,
            price: "180000",
            status: "ACTIVE",
          },
        ],
      }),
    }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/merchant/products");
  await expect(page.getByRole("heading", { name: "Sản phẩm" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tách men xanh" })).toBeVisible();
  await expect(page.getByText("Đang bán")).not.toHaveClass(/rounded-full/);
  await expect(page.locator("body")).not.toContainText(/demo mode|mock api|milestone 2|backend api/i);
  await page.screenshot({ path: "test-results/merchant-products-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/merchant-products-mobile.png", fullPage: true });
});
