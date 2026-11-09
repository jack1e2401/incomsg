import { expect, test } from "@playwright/test";

test("Admin overview and merchant application queue render", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Tổng quan hệ thống" })).toBeVisible();
  await page.goto("/admin/applications");
  await expect(page.getByRole("heading", { name: "Duyệt cửa hàng" })).toBeVisible();
  await expect(page.getByText("Gốm Mây")).toBeVisible();
  await expect(page.getByRole("button", { name: "Duyệt cửa hàng" })).toBeVisible();
});

test("unapproved merchant is blocked from management", async ({ page }) => {
  await page.goto("/merchant/gommay");
  await expect(page.getByRole("heading", { name: "Cửa hàng đang chờ duyệt" })).toBeVisible();
  await expect(page.getByText(/Admin cần duyệt hồ sơ/)).toBeVisible();
});

test("approving a merchant initializes its loyalty wallet and configuration", async ({ page }) => {
  await page.goto("/admin/applications");
  await page.getByRole("button", { name: "Duyệt cửa hàng" }).click();
  await page.getByRole("link", { name: "Mở Loyalty của Merchant" }).click();
  await expect(page.getByRole("heading", { name: "Chương trình tích điểm" })).toBeVisible();
  await expect(page.getByLabel("Mỗi bao nhiêu đồng thực trả nhận 1 điểm cơ bản?")).toHaveValue("10000");
});

test("Member checkout remains pending and shows no points award", async ({ page }) => {
  await page.goto("/member/moc");
  await page.getByRole("button", { name: "Thêm Bình gốm Sớm Mai vào giỏ" }).click();
  await page.getByRole("link", { name: "Giỏ hàng (1)" }).click();
  await page.getByRole("link", { name: "Tiếp tục thanh toán" }).click();
  await page.getByRole("button", { name: /Tạo đơn chờ thanh toán/ }).click();
  await expect(page.getByText("Đơn đang chờ xử lý")).toBeVisible();
  await expect(page.getByText(/Chưa kết nối/)).toHaveCount(0);
  await expect(page.getByText(/Điểm và tier chỉ cập nhật khi backend xác nhận đơn PAID/)).toBeVisible();
});

test("Member wallet is merchant-scoped and responsive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/member/hikari/wallet");
  await expect(page.getByRole("heading", { name: "Ví điểm của bạn" })).toBeVisible();
  await expect(page.getByText("Unranked", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng Member" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("Member wallet keeps its dark background and order history is private", async ({ page }) => {
  await page.goto("/member/moc/wallet");
  const walletCard = page.locator(".surface").first();
  await expect(walletCard).toHaveCSS("background-color", "rgb(47, 88, 58)");
  await page.getByRole("link", { name: "Đơn hàng" }).click();
  await expect(page.getByText(/LC-1042/).first()).toBeVisible();
  await expect(page.getByText(/LC-1041|LC-1038/)).toHaveCount(0);
});

test("Member voucher redemption updates points from the adapter response", async ({ page }) => {
  await page.goto("/member/moc/vouchers");
  await expect(page.getByText("540 điểm")).toBeVisible();
  await page.getByRole("button", { name: "Đổi ngay" }).first().click();
  await expect(page.getByRole("status")).toContainText("Số dư mới: 340 điểm");
});

test("Merchant product and loyalty screens render desktop-first", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/merchant/moc/products");
  await expect(page.getByRole("heading", { name: "Sản phẩm", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm sản phẩm" })).toBeVisible();
  await page.goto("/merchant/moc/loyalty");
  await expect(page.getByRole("heading", { name: "Chương trình tích điểm" })).toBeVisible();
  await expect(page.getByText("Platinum", { exact: true })).toBeVisible();
});
