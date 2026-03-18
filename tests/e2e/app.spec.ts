import { expect, test } from "@playwright/test";

test("landing page lists the three instruments", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Browse the aged care corpus as a living, linked reading surface.",
  );
  await expect(page.getByRole("link", { name: "Aged Care Act 2024" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aged Care Rules 2025" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Aged Care (Consequential and Transitional Provisions) Rules 2025" }),
  ).toBeVisible();
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

test("reader deep links, opens a term definition, and follows a crossreference", async ({ page }) => {
  await page.goto("/aged-care-act-2024#7-definitions");

  await expect.poll(async () => page.locator(".margin-rail h2").textContent()).toContain("7 Definitions");
  await page
    .locator('[id="7-definitions"] .segment-term-list .term-disclosure summary')
    .filter({ hasText: "access approval" })
    .first()
    .click();
  await expect(page.locator('[id="7-definitions"] .segment-term-list')).toContainText(
    "approval under subsection 65(2).",
  );

  await page.locator('[id="7-definitions"] .segment-link-row a[href="#294-accommodation-agreements"]').click({
    force: true,
  });
  await expect(page).toHaveURL(/#294-accommodation-agreements$/);
  await expect(page.locator('[id="294-accommodation-agreements"]')).toContainText("Accommodation agreements");
});

test("reader shows related provisions across instruments and renders tables", async ({ page }) => {
  await page.goto("/aged-care-act-2024#86-priority-category-decisions");

  await expect
    .poll(async () => page.locator(".margin-rail h2").textContent())
    .toContain("86 Priority category decisions");
  await expect(page.getByText("Currently showing for")).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "86‑5 All service groups—period in which priority category decisions must be made",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "87‑5 Priority categories and eligibility criteria for classification type ongoing",
    }),
  ).toBeVisible();

  await page.goto("/aged-care-rules-2025#87-5-priority-categories-and-eligibility-criteria-for-classification-type-ongoing");
  await expect(page.locator(".margin-rail__tracking-link")).toContainText(
    "87‑5 Priority categories and eligibility criteria for classification type ongoing",
  );
  await page.evaluate(() => {
    const section = document.getElementById("87-5-priority-categories-and-eligibility-criteria-for-classification-type-ongoing");

    if (!section) {
      return;
    }

    const top = section.getBoundingClientRect().top + window.scrollY;
    const target = top + Math.max(section.clientHeight * 0.45, 480);
    window.scrollTo({ top: target });
  });
  await expect(page.locator(".margin-rail__tracking-link")).toContainText(
    "87‑5 Priority categories and eligibility criteria for classification type ongoing",
  );
  const section = page.locator('[id="87-5-priority-categories-and-eligibility-criteria-for-classification-type-ongoing"]');
  await expect(section.locator(".reader-table")).toHaveCount(2);
  await expect(section.locator(".reader-table").first()).toContainText("Priority categories");
});
