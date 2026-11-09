import { expect, test } from "@playwright/test";

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

  await expect(page.getByText("Hồ sơ #42 đang chờ Admin duyệt.")).toBeVisible();
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
  await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
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
            id: 42,
            applicantId: 9,
            storeName: "Nhà Mây",
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
          },
        ],
      }),
    });
  });
  await page.route("**/api/admin/merchants/42/approve", async (route) => {
    approvalAuthorization = route.request().headers().authorization ?? "";
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
        merchant: { id: 20, name: "Nhà Mây", slug: "store-42", isActive: true },
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@test.local");
  await page.getByLabel("Mật khẩu").fill("seeded-admin-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Nhà Mây", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duyệt", exact: false }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận duyệt" }).click();

  await expect(page.getByText("Đã duyệt", { exact: true })).toBeVisible();
  expect(approvalAuthorization).toBe("Bearer signed-admin-token");
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
  await expect(page.getByText("Gốm Mây", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Từ chối", exact: false }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Từ chối hồ sơ Merchant?");
  await expect(dialog).toContainText("sẽ giữ tài khoản Merchant ở trạng thái chưa hoạt động");
  await page.getByRole("button", { name: "Xác nhận từ chối" }).click();

  await expect(page.getByText("Đã từ chối", { exact: true })).toBeVisible();
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
