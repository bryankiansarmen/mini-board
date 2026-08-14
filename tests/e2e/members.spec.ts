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

async function joinWorkspace(
  page: import("@playwright/test").Page,
  email: string,
  workspaceName: string,
  code: string,
) {
  await signUp(page, email);
  await page.getByLabel("Invite code").fill(code);
  await page.getByRole("button", { name: "Join workspace" }).click();
  await expect(page.getByText(workspaceName)).toBeVisible();
}

async function openMembersPage(
  page: import("@playwright/test").Page,
  workspaceName: string,
) {
  const href = await page
    .getByRole("link", { name: new RegExp(workspaceName) })
    .getAttribute("href");
  const membersUrl = href!.replace(/\/boards$/, "/members");
  await page.goto(membersUrl);
  await expect(page).toHaveURL(/\/workspaces\/.+\/members/);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
}

test("owner can view the member list and manage members; the Owner row has no self-removal actions", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const stamp = Date.now();
  const workspaceName = `Members WS ${stamp}`;
  const emailA = `e2e-members-a-${stamp}@example.com`;
  const emailB = `e2e-members-b-${stamp + 1}@example.com`;

  // Owner A creates a workspace and invites B.
  await signUp(pageA, emailA);
  await pageA.getByLabel("Workspace name").fill(workspaceName);
  await pageA.getByRole("button", { name: "Create workspace" }).click();
  await expect(pageA.getByText(workspaceName)).toBeVisible();

  await pageA
    .getByRole("button", { name: `Invite ${workspaceName}` })
    .click();
  const code = await pageA.getByTestId("invite-code").textContent();
  expect(code).toMatch(CODE_PATTERN);

  await joinWorkspace(pageB, emailB, workspaceName, code!);

  // Owner sees both members on the members page.
  await openMembersPage(pageA, workspaceName);
  await expect(pageA.getByText(emailA)).toBeVisible();
  await expect(pageA.getByText(emailB)).toBeVisible();

  // The Owner's own row is labelled Owner and offers no manage/remove buttons.
  const ownerRow = pageA.getByText(emailA).locator("..").locator("..");
  await expect(ownerRow.getByText("Owner", { exact: true })).toBeVisible();
  await expect(ownerRow.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(ownerRow.getByRole("button", { name: /Make/ })).toHaveCount(0);

  // The other member can be promoted (Make admin) and removed.
  const memberRow = pageA.getByText(emailB).locator("..").locator("..");
  await expect(memberRow.getByText("Member", { exact: true })).toBeVisible();
  await expect(
    memberRow.getByRole("button", { name: "Make admin" }),
  ).toBeVisible();
  await expect(memberRow.getByRole("button", { name: "Remove" })).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("a plain member sees the member list but no remove/promote actions", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const stamp = Date.now();
  const workspaceName = `Members View WS ${stamp}`;
  const emailA = `e2e-members-c-${stamp}@example.com`;
  const emailB = `e2e-members-d-${stamp + 1}@example.com`;

  await signUp(pageA, emailA);
  await pageA.getByLabel("Workspace name").fill(workspaceName);
  await pageA.getByRole("button", { name: "Create workspace" }).click();
  await expect(pageA.getByText(workspaceName)).toBeVisible();

  await pageA
    .getByRole("button", { name: `Invite ${workspaceName}` })
    .click();
  const code = await pageA.getByTestId("invite-code").textContent();
  expect(code).toMatch(CODE_PATTERN);

  await joinWorkspace(pageB, emailB, workspaceName, code!);

  // B is a plain member — the members page shows both rows but no actions.
  await openMembersPage(pageB, workspaceName);
  await expect(pageB.getByText(emailA)).toBeVisible();
  await expect(pageB.getByText(emailB)).toBeVisible();
  await expect(pageB.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(pageB.getByRole("button", { name: /Make/ })).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});