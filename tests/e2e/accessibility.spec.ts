import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const password = "correct-horse-battery-staple";

async function setupBoard(page: import("@playwright/test").Page, id: string) {
  const email = `a11y-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByLabel("Workspace name").fill(`A11y WS ${id}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByText(`A11y WS ${id}`)).toBeVisible();

  await page.getByRole("link", { name: new RegExp(`A11y WS ${id}`) }).click();
  await expect(page).toHaveURL(/\/workspaces\/.+\/boards/);

  await page.getByLabel("Board title").fill(`A11y Board ${id}`);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(`A11y Board ${id}`)).toBeVisible();

  await page.getByText(`A11y Board ${id}`, { exact: true }).click();
  await expect(page).toHaveURL(/\/boards\/.+/);

  await page.getByLabel("Column title").fill("To Do");
  await page.getByRole("button", { name: "Create column" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "To Do" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeEnabled();

  await page.getByLabel("Column title").fill("Done");
  await page.getByRole("button", { name: "Create column" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Done" }),
  ).toBeVisible();

  await page.getByLabel("Card title").first().fill("Accessible Card");
  await page.getByRole("button", { name: "+ Add card" }).first().click();
  await expect(
    page.getByText("Accessible Card", { exact: true }),
  ).toBeVisible();
}

test.describe("Accessibility Pass (axe-core & keyboard nav)", () => {
  test("board view has no critical or serious WCAG violations", async ({
    page,
  }) => {
    await setupBoard(page, "view");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousOrCritical = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(seriousOrCritical).toEqual([]);
  });

  test("card detail modal has no critical or serious WCAG violations", async ({
    page,
  }) => {
    await setupBoard(page, "modal");

    await page.getByText("Accessible Card", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Card details" }),
    ).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousOrCritical = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(seriousOrCritical).toEqual([]);
  });

  test("keyboard navigation: focus management and move card menu", async ({
    page,
  }) => {
    await setupBoard(page, "keynav");

    // Open card detail modal via click or Enter key
    const cardElement = page.getByText("Accessible Card", { exact: true });
    await cardElement.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Escape closes modal
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Open card actions menu via the menu button
    const actionsButton = page.getByRole("button", {
      name: "Actions for Accessible Card",
    });
    await actionsButton.click();

    // Menu opens
    const menu = page.getByRole("menu", {
      name: "Actions for Accessible Card",
    });
    await expect(menu).toBeVisible();

    // Move to Done via menu
    const moveToDone = page.getByRole("menuitem", { name: "Move to Done" });
    await moveToDone.click();

    // Menu closes and card is moved to Done column
    await expect(menu).toBeHidden();

    // Verify card is now in Done column
    const doneColumn = page
      .locator("div")
      .filter({ hasText: /^Done/ })
      .first();
    await expect(
      doneColumn.getByText("Accessible Card", { exact: true }),
    ).toBeVisible();
  });
});
