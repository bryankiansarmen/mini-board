import { expect, test } from "@playwright/test";

const timestamp = Date.now();
const email = `e2e-${timestamp}@example.com`;
const password = "correct-horse-battery-staple";

test("signs up, lands on /workspaces, and stays logged in after reload", async ({
  page,
}) => {
  await page.goto("/signup");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/workspaces/);
  await expect(
    page.getByText(`Signed in as ${email}`),
  ).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/workspaces/);
  await expect(
    page.getByText(`Signed in as ${email}`),
  ).toBeVisible();
});

test("logs in again after signing out", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/workspaces/);
  await expect(
    page.getByText(`Signed in as ${email}`),
  ).toBeVisible();
});

test("redirects an unauthenticated user away from /workspaces", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login/);
});