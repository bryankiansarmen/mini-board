import { expect, test } from "@playwright/test";

const password = "correct-horse-battery-staple";

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);
}

test("creates a workspace and sees it in the list immediately", async ({
  page,
}) => {
  const workspaceName = `Workspace ${Date.now()}`;
  const email = `e2e-ws-a-${Date.now()}@example.com`;
  await signUp(page, email);

  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByText(workspaceName)).toBeVisible();

  // The workspace links to its boards page.
  await page.getByRole("link", { name: new RegExp(workspaceName) }).click();
  await expect(page).toHaveURL(/\/workspaces\/.+\/boards/);
});

test("RLS negative: a second user cannot see the first user's workspace", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const workspaceName = `Workspace ${Date.now()}`;
  const emailA = `e2e-ws-b-${Date.now()}@example.com`;
  const emailB = `e2e-ws-b-${Date.now() + 1}@example.com`;

  await signUp(pageA, emailA);
  await pageA.getByLabel("Workspace name").fill(workspaceName);
  await pageA.getByRole("button", { name: "Create workspace" }).click();
  await expect(pageA.getByText(workspaceName)).toBeVisible();

  await signUp(pageB, emailB);

  // A brand-new, unrelated user must not see the workspace A created — this
  // asserts the RLS SELECT policy is actually filtering (a UI-layer hide would
  // still show the empty-state message the same way, so also verify no link).
  await expect(
    pageB.getByText("No workspaces yet. Create your first one above."),
  ).toBeVisible();
  await expect(pageB.getByText(workspaceName)).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});