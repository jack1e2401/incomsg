import { expect, test } from "@playwright/test";

test("mock mode restores the offline member demo without backend calls", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Mua ở nơi bạn yêu/ })).toBeVisible();
  await page.getByRole("link", { name: "Trải nghiệm Member" }).click();
  await expect(page.getByRole("heading", { name: "Chút ấm áp cho mỗi ngày" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bình gốm Sớm Mai" }).first()).toBeVisible();
  expect(apiRequests).toEqual([]);
});
