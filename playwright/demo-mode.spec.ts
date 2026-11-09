import { expect, test } from "@playwright/test";

test("mock mode restores the offline member demo without backend calls", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Loyalty commerce demo" })).toBeVisible();
  await page.getByRole("link", { name: "Mở trải nghiệm Member" }).click();
  await expect(page.getByRole("heading", { name: "Bình gốm Sớm Mai" })).toBeVisible();
  expect(apiRequests).toEqual([]);
});
