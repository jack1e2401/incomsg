import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/merchants/history", (route) =>
    route.fulfill({ json: { applications: [] } }),
  );
});

test("landing keeps the entry flow clear and protects the Admin URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Mua ở nơi bạn yêu/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Gốm thủ công trong một cửa hàng độc lập" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Tạo tài khoản" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Trạng thái hồ sơ" })).toHaveAttribute(
    "href",
    "/application/status",
  );
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(desktopOverflow).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(mobileOverflow).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("Member registration posts the M2 request and confirms backend response", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/auth/register/member", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: 8, email: "member@test.local", role: "MEMBER", isActive: true } }),
    });
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("member@test.local");
  await page.getByLabel("Mật khẩu").fill("member-password-123");
  await page.getByRole("button", { name: "Tạo tài khoản Member" }).click();

  await expect(page.getByText("Tài khoản đã sẵn sàng")).toBeVisible();
  expect(requestBody).toEqual({ email: "member@test.local", password: "member-password-123" });
});

test("Merchant application confirms PENDING and does not create a session", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/auth/register/merchant", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: 9, email: "shop@test.local", role: "MERCHANT", isActive: false },
        application: {
          id: 42,
          applicantId: 9,
          storeName: "Nhà Mây",
          status: "PENDING",
          reviewedById: null,
          reviewedAt: null,
        },
      }),
    });
  });

  await page.goto("/register");
  await page.getByRole("button", { name: "Merchant", exact: true }).click();
  await page.getByLabel("Tên cửa hàng").fill("Nhà Mây");
  await page.getByLabel("Email").fill("shop@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Gửi hồ sơ Merchant" }).click();

  await expect(page.getByText("Hồ sơ #42 đang chờ Admin phê duyệt.")).toBeVisible();
  expect(requestBody).toEqual({
    email: "shop@test.local",
    password: "merchant-password-123",
    storeName: "Nhà Mây",
  });
  expect(await page.evaluate(() => sessionStorage.getItem("loyalty.m2.session"))).toBeNull();
  await page.getByRole("link", { name: "Theo dõi trạng thái hồ sơ" }).click();
  await expect(page).toHaveURL(/\/application\/status$/);
  await expect(page.getByLabel("Email đăng ký")).toHaveValue("shop@test.local");
});

test("Merchant status screen loads pending status and clears the password after lookup", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/auth/application-status", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: {
          id: 42,
          applicantId: 9,
          storeName: "Nhà Mây",
          status: "PENDING",
          reviewedById: null,
          reviewedAt: null,
        },
      }),
    });
  });

  await page.goto("/application/status");
  await page.getByLabel("Email đăng ký").fill("shop@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Kiểm tra trạng thái" }).click();

  await expect(page.getByRole("heading", { name: "Hồ sơ đang chờ duyệt" })).toBeVisible();
  expect(requestBody).toEqual({ email: "shop@test.local", password: "merchant-password-123" });
  await expect(page.getByLabel("Mật khẩu")).toHaveValue("");
  expect(await page.evaluate(() => sessionStorage.getItem("loyalty.m2.session"))).toBeNull();
});

test("Merchant status screen shows approved decision and login action", async ({ page }) => {
  await page.route("**/api/auth/application-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: {
          id: 42,
          applicantId: 9,
          storeName: "Nhà Mây",
          status: "APPROVED",
          reviewedById: 1,
          reviewedAt: "2026-11-09T03:00:00.000Z",
        },
      }),
    });
  });

  await page.goto("/application/status");
  await page.getByLabel("Email đăng ký").fill("shop@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Kiểm tra trạng thái" }).click();

  await expect(page.getByRole("heading", { name: "Hồ sơ đã được phê duyệt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập vào cửa hàng" })).toHaveAttribute(
    "href",
    "/login?registered=merchant-approved",
  );
});

test("Merchant status screen shows a rejected decision", async ({ page }) => {
  await page.route("**/api/auth/application-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: {
          id: 43,
          applicantId: 10,
          storeName: "Gốm Mây",
          status: "REJECTED",
          reviewedById: 1,
          reviewedAt: "2026-11-09T03:00:00.000Z",
        },
      }),
    });
  });

  await page.goto("/application/status");
  await page.getByLabel("Email đăng ký").fill("rejected@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Kiểm tra trạng thái" }).click();

  await expect(page.getByRole("heading", { name: "Hồ sơ chưa được chấp thuận" })).toBeVisible();
  await expect(page.getByText("Từ chối", { exact: true })).toBeVisible();
});

test("login takes role from API response and sends protected Merchant request with Bearer token", async ({
  page,
}) => {
  let authorization = "";
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "signed-merchant-token",
        user: { id: 11, email: "merchant@test.local", role: "MERCHANT", isActive: true },
      }),
    });
  });
  await page.route("**/api/merchant/me", async (route) => {
    authorization = route.request().headers().authorization ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ merchant: { id: 2, name: "Mộc Studio", slug: "store-2", isActive: true } }),
    });
  });
  await page.route("**/api/merchant/products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("merchant@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByRole("heading", { name: "Mộc Studio" })).toBeVisible();
  expect(authorization).toBe("Bearer signed-merchant-token");
});

test("Admin reviews applications through authenticated endpoints", async ({ page }) => {
  let approvalAuthorization = "";
  let historyAuthorization = "";
  let approved = false;
  const reviewedAt = "2026-11-09T03:00:00.000Z";
  const reviewed = {
    id: 42,
    applicantId: 9,
    storeName: "Nhà Mây",
    status: "APPROVED",
    reviewedById: 1,
    reviewedAt,
  };
  await page.route("**/api/admin/merchants/history", (route) => {
    historyAuthorization = route.request().headers().authorization ?? "";
    return route.fulfill({
      json: {
        applications: [
          ...(approved ? [reviewed] : []),
          { ...reviewed, id: 40, storeName: "Cửa hàng trước", status: "REJECTED" },
        ],
      },
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "signed-admin-token",
        user: { id: 1, email: "admin@test.local", role: "ADMIN", isActive: true },
      }),
    });
  });
  await page.route("**/api/admin/merchants/pending", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applications: approved
          ? []
          : [{ ...reviewed, status: "PENDING", reviewedById: null, reviewedAt: null }],
      }),
    });
  });
  await page.route("**/api/admin/merchants/42/approve", async (route) => {
    approvalAuthorization = route.request().headers().authorization ?? "";
    approved = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: reviewed,
        merchant: { id: 20, name: "Nhà Mây", slug: "store-42", isActive: true },
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@test.local");
  await page.getByLabel("Mật khẩu").fill("seeded-admin-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Nhà Mây", exact: true })).toBeVisible();
  const history = page.getByRole("region", { name: "Lịch sử xét duyệt" });
  await expect(history.getByRole("listitem").filter({ hasText: "Cửa hàng trước" })).toContainText(
    "Đã từ chối",
  );
  await expect(history.getByText("Nhà Mây", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Duyệt", exact: false }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận duyệt" }).click();

  await expect(page.getByRole("status")).toContainText("Đã duyệt Nhà Mây");
  expect(approvalAuthorization).toBe("Bearer signed-admin-token");
  const approvedRow = history.getByRole("listitem").filter({ hasText: "Nhà Mây" });
  await expect(approvedRow).toContainText("Đã duyệt");
  await expect(approvedRow.locator("time")).toHaveAttribute("datetime", reviewedAt);
  await expect(page.getByRole("button", { name: "Duyệt Nhà Mây" })).toHaveCount(0);
  await page.reload();
  await expect(approvedRow).toContainText("Đã duyệt");
  expect(historyAuthorization).toBe("Bearer signed-admin-token");
});

test("Admin approval queue shows each API application once and keeps actions with its row", async ({
  page,
}) => {
  let rejectedPath = "";
  const applications = [
    {
      id: 55,
      applicantId: 105,
      storeName: "Pending admin read",
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
    },
    {
      id: 56,
      applicantId: 106,
      storeName: "Gốm Mây",
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
    },
  ];
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "signed-admin-token",
        user: { id: 1, email: "admin@test.local", role: "ADMIN", isActive: true },
      }),
    });
  });
  await page.route("**/api/admin/merchants/pending", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ applications }),
    });
  });
  await page.route("**/api/admin/merchants/56/reject", async (route) => {
    rejectedPath = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: {
          ...applications[1],
          status: "REJECTED",
          reviewedById: 1,
          reviewedAt: "2026-11-09T03:00:00.000Z",
        },
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@test.local");
  await page.getByLabel("Mật khẩu").fill("seeded-admin-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByRole("heading", { name: "Duyệt hồ sơ cửa hàng" })).toBeVisible();
  await expect(page.getByText("Pending admin read", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Gốm Mây", { exact: true })).toHaveCount(1);
  const secondRow = page.getByRole("listitem").filter({ hasText: "Gốm Mây" });
  await expect(secondRow).toContainText("#56");
  await expect(secondRow).toContainText("#106");
  await expect(secondRow.getByRole("button", { name: "Duyệt Gốm Mây" })).toBeVisible();
  await expect(secondRow.getByRole("button", { name: "Từ chối Gốm Mây" })).toBeVisible();
  await expect(secondRow.getByRole("button", { name: "Từ chối Gốm Mây" })).toHaveCSS("white-space", "nowrap");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Pending admin read", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator("aside").evaluate((element) => element.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const mobileTitle = page.getByRole("heading", { name: "Duyệt hồ sơ cửa hàng" });
  expect(await mobileTitle.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const rejectButton = secondRow.getByRole("button", { name: "Từ chối Gốm Mây" });
  const rejectBounds = await rejectButton.boundingBox();
  expect(rejectBounds).not.toBeNull();
  expect(rejectBounds!.x + rejectBounds!.width).toBeLessThanOrEqual(390);
  await secondRow.getByRole("button", { name: "Từ chối Gốm Mây" }).click();
  await page.getByRole("button", { name: "Xác nhận từ chối" }).click();
  await expect(page.getByText("Đã từ chối Gốm Mây.", { exact: true })).toBeVisible();
  expect(rejectedPath).toBe("/api/admin/merchants/56/reject");
});

test("Admin confirms rejection in an in-app dialog before sending the API request", async ({ page }) => {
  let rejectionAuthorization = "";
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "signed-admin-token",
        user: { id: 1, email: "admin@test.local", role: "ADMIN", isActive: true },
      }),
    });
  });
  await page.route("**/api/admin/merchants/pending", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applications: [
          {
            id: 43,
            applicantId: 10,
            storeName: "Gốm Mây",
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
          },
        ],
      }),
    });
  });
  await page.route("**/api/admin/merchants/43/reject", async (route) => {
    rejectionAuthorization = route.request().headers().authorization ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: {
          id: 43,
          applicantId: 10,
          storeName: "Gốm Mây",
          status: "REJECTED",
          reviewedById: 1,
          reviewedAt: "2026-11-09T03:00:00.000Z",
        },
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@test.local");
  await page.getByLabel("Mật khẩu").fill("seeded-admin-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Gốm Mây", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Từ chối", exact: false }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Từ chối hồ sơ Merchant?");
  await expect(dialog).toContainText("sẽ khóa tài khoản Merchant");
  await page.getByRole("button", { name: "Xác nhận từ chối" }).click();

  await expect(page.getByRole("status")).toContainText("Đã từ chối Gốm Mây");
  expect(rejectionAuthorization).toBe("Bearer signed-admin-token");
});

test("pending Merchant login shows the backend pending status message", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "MERCHANT_PENDING" }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("pending@test.local");
  await page.getByLabel("Mật khẩu").fill("merchant-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByRole("alert")).toContainText("đang chờ Admin duyệt");
  await page.getByRole("link", { name: "Xem trạng thái hồ sơ Merchant" }).click();
  await expect(page.getByLabel("Email đăng ký")).toHaveValue("pending@test.local");
});

test("status lookup shows retryable invalid-credential error from backend", async ({ page }) => {
  await page.route("**/api/auth/application-status", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "INVALID_CREDENTIALS" }),
    });
  });

  await page.goto("/application/status");
  await page.getByLabel("Email đăng ký").fill("shop@test.local");
  await page.getByLabel("Mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: "Kiểm tra trạng thái" }).click();

  await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu chưa đúng");
  await expect(page.getByRole("button", { name: "Kiểm tra trạng thái" })).toBeEnabled();
  await expect(page.getByLabel("Mật khẩu")).toHaveValue("");
});
