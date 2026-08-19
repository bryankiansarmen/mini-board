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

async function createWorkspace(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function openBoardsPage(
  page: import("@playwright/test").Page,
  workspaceName: string,
) {
  await page
    .getByRole("link", { name: new RegExp(workspaceName) })
    .click();
  await expect(page).toHaveURL(/\/workspaces\/.+\/boards/);
  await expect(page.getByRole("button", { name: "Create board" })).toBeVisible();
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

async function generateInvite(
  page: import("@playwright/test").Page,
  workspaceName: string,
) {
  await page
    .getByRole("button", { name: `Invite ${workspaceName}` })
    .click();
  const code = await page.getByTestId("invite-code").textContent();
  expect(code).toMatch(CODE_PATTERN);
  return code!;
}

test("owner can create, rename, and delete a board", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Boards WS ${stamp}`;
  const email = `e2e-boards-a-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  // Create a board; it appears in the grid.
  await page.getByLabel("Board title").fill("Sprint 24");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText("Sprint 24")).toBeVisible();

  // Rename via double-click on the card.
  await page.getByText("Sprint 24").dblclick();
  const renameInput = page.getByLabel("Rename board");
  await expect(renameInput).toBeVisible();
  await renameInput.fill("Sprint 25");
  await renameInput.press("Enter");
  await expect(page.getByText("Sprint 25")).toBeVisible();

  // Delete via the custom confirmation modal.
  await page
    .getByRole("button", { name: "Delete Sprint 25" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Delete board?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete board" }).click();
  await expect(page.getByText("Sprint 25")).toHaveCount(0);
  await expect(
    page.getByText("No boards yet — create your first board above."),
  ).toBeVisible();

  await context.close();
});

test("a plain member sees boards but no delete buttons", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const stamp = Date.now();
  const workspaceName = `Boards View WS ${stamp}`;
  const emailA = `e2e-boards-c-${stamp}@example.com`;
  const emailB = `e2e-boards-d-${stamp + 1}@example.com`;

  // Owner A creates a workspace, generates an invite code, then creates a board.
  await signUp(pageA, emailA);
  await createWorkspace(pageA, workspaceName);

  const code = await generateInvite(pageA, workspaceName);

  await openBoardsPage(pageA, workspaceName);

  await pageA.getByLabel("Board title").fill("Shared Board");
  await pageA.getByRole("button", { name: "Create board" }).click();
  await expect(pageA.getByText("Shared Board")).toBeVisible();

  await joinWorkspace(pageB, emailB, workspaceName, code);

  // B (plain member) sees the board but no delete button.
  await openBoardsPage(pageB, workspaceName);
  await expect(pageB.getByText("Shared Board")).toBeVisible();
  await expect(pageB.getByRole("button", { name: /^Delete / })).toHaveCount(0);

  // A (owner) still sees the delete button.
  await expect(
    pageA.getByRole("button", { name: "Delete Shared Board" }),
  ).toBeVisible();

  await contextA.close();
  await contextB.close();
});
