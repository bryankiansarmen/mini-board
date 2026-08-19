import { expect, test } from "@playwright/test";

const password = "correct-horse-battery-staple";
const CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);
}

test("invite flow: owner generates a code and a second user joins the workspace", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const workspaceName = `Invite WS ${Date.now()}`;
  const emailA = `e2e-inv-a-${Date.now()}@example.com`;
  const emailB = `e2e-inv-b-${Date.now() + 1}@example.com`;

  // Owner A creates a workspace.
  await signUp(pageA, emailA);
  await pageA.getByLabel("Workspace name").fill(workspaceName);
  await pageA.getByRole("button", { name: "Create workspace" }).click();
  await expect(pageA.getByText(workspaceName)).toBeVisible();

  // Owner generates an invite code and copies it from the UI.
  await pageA
    .getByRole("button", { name: `Invite ${workspaceName}` })
    .click();
  const inviteCode = await pageA.getByTestId("invite-code").textContent();
  expect(inviteCode).toMatch(CODE_PATTERN);

  // User B signs up and redeems the code.
  await signUp(pageB, emailB);
  await pageB.getByLabel("Invite code").fill(inviteCode!);
  await pageB.getByRole("button", { name: "Join workspace" }).click();

  // The join form refreshes the workspace list, which now shows the workspace.
  await expect(pageB.getByText(workspaceName)).toBeVisible();

  // B can open it; membership is real, not just a visible row.
  await pageB.getByRole("link", { name: new RegExp(workspaceName) }).click();
  await expect(pageB).toHaveURL(/\/workspaces\/.+\/boards/);

  await contextA.close();
  await contextB.close();
});

test("joining with an unknown code shows a clear error", async ({ page }) => {
  const email = `e2e-inv-c-${Date.now()}@example.com`;
  await signUp(page, email);

  await page.getByLabel("Invite code").fill("ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "Join workspace" }).click();

  await expect(page.getByText("Invalid or unknown invite code.")).toBeVisible();
});