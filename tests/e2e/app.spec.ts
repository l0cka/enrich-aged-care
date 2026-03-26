import { expect, test } from "@playwright/test";

test("landing page lists the three instruments", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Aged care legislation",
  );
  await expect(page.getByRole("link", { name: "Aged Care Act 2024" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aged Care Rules 2025" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Aged Care (Consequential and Transitional Provisions) Rules 2025" }),
  ).toBeVisible();
});

test("dark mode toggle applies site-wide and persists on reload", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.locator(".site-header").getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("search returns a section result and links into the reader", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox").fill("Short title");
  await page.getByRole("button", { name: "Search" }).click();

  const resultLink = page.getByRole("link", { name: "1 Short title" }).first();
  await expect(resultLink).toBeVisible();
  await resultLink.click();

  await expect(page).toHaveURL(/aged-care-act-2024#1-short-title$/);
  await expect(page.locator('[id="1-short-title"]')).toContainText("This Act is the Aged Care Act 2024.");
});

test("reader deep links and shows definitions with terms in margin rail", async ({ page }) => {
  await page.goto("/aged-care-act-2024#7-definitions");

  await expect
    .poll(async () =>
      page.evaluate(() => Math.abs(document.getElementById("7-definitions")?.getBoundingClientRect().top ?? 9999)),
    )
    .toBeLessThan(220);
  await expect.poll(async () => page.locator(".margin-rail h2").textContent()).toContain("7 Definitions");

  // Section 7 should contain the definitions text (Kanon renders full section text)
  await expect(page.locator('[id="7-definitions"]')).toContainText("access approval");
  await expect(page.locator('[id="7-definitions"]')).toContainText("accommodation agreement");

  // Margin rail should show defined terms for section 7
  await expect(page.locator(".margin-rail")).toContainText("Defined terms");
});

test("compare page filters linked sections and opens related provisions", async ({ page }) => {
  await page.goto("/compare");

  await page.getByRole("checkbox", { name: "Only show linked sections" }).check();
  await page.getByRole("button", { name: /86 Priority category decisions/ }).click();

  await expect(page.getByText("All service groups—period in which priority category decisions must be made")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in reader" })).toBeVisible();
});

test("maps page and detail route render built-in map content", async ({ page }) => {
  await page.goto("/maps");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Navigate legislation by decision topic.");
  await expect(page.getByRole("link", { name: /Provider Registration/ })).toBeVisible();

  await page.getByRole("link", { name: /Provider Registration/ }).click();
  await expect(page).toHaveURL(/\/maps\/provider-registration$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Provider Registration");
  await expect(page.getByText("No provisions added to this section yet.").first()).toBeVisible();
});

test("pathway page shows connected provisions and links back to the reader", async ({ page }) => {
  await page.goto("/pathway/aged-care-act-2024/86-priority-category-decisions");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("86 Priority category decisions");
  await expect(page.getByText("specified by").first()).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "86‑5 All service groups—period in which priority category decisions must be made",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Back to reader" })).toHaveAttribute(
    "href",
    "/aged-care-act-2024#86-priority-category-decisions",
  );
});
