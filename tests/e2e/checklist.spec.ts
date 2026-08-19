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

async function openBoard(
  page: import("@playwright/test").Page,
  boardTitle: string,
) {
  await page.getByText(boardTitle, { exact: true }).click();
  await expect(page).toHaveURL(/\/boards\/.+/);
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
}

async function addColumn(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.getByLabel("Column title").fill(title);
  await page.getByRole("button", { name: "Create column" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: title }),
  ).toBeVisible();
  // The column can render via the Realtime echo before the server action
  // finishes. Wait for the button to re-enable so the next interaction isn't
  // swallowed by a disabled control (see realtime.spec.ts).
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeEnabled();
}

async function addCard(page: import("@playwright/test").Page, title: string) {
  await page.getByLabel("Card title").fill(title);
  await page.getByRole("button", { name: "+ Add card" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
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

// Adds a checklist item through the card detail modal and waits for it to
// render (the realtime echo or the create round-trip).
async function addChecklistItem(
  dialog: import("@playwright/test").Locator,
  content: string,
) {
  await dialog.getByLabel("Checklist item", { exact: true }).fill(content);
  await dialog.getByLabel("Checklist item", { exact: true }).press("Enter");
  await expect(dialog.getByText(content, { exact: true })).toBeVisible();
}

test("checklist items persist across a reload with completion progress", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Checklist WS ${stamp}`;
  const boardTitle = `Checklist Board ${stamp}`;
  const email = `e2e-checklist-persist-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Checklist Card");

  const dialog = page.getByRole("dialog", { name: "Card details" });
  await page.getByText("Checklist Card", { exact: true }).click();
  await expect(dialog).toBeVisible();

  // Add three items in order.
  await addChecklistItem(dialog, "Alpha");
  await addChecklistItem(dialog, "Beta");
  await addChecklistItem(dialog, "Gamma");

  // Progress reads 0/3 before any toggle.
  await expect(dialog.getByText("0/3", { exact: true })).toBeVisible();

  // Toggle "Beta" complete; progress becomes 1/3 and the item strikes through.
  // Role-scoped (not getByLabel) so the delete button's "Delete item Beta"
  // accessible name can't substring-match.
  await dialog.getByRole("checkbox", { name: "Beta" }).check();
  await expect(dialog.getByText("1/3", { exact: true })).toBeVisible();

  // Close, hard reload, reopen: everything persists.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();

  await page.getByText("Checklist Card", { exact: true }).click();
  await expect(dialog).toBeVisible();

  await expect(dialog.getByText("Alpha", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Beta", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Gamma", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Beta" })).toBeChecked();
  await expect(dialog.getByText("1/3", { exact: true })).toBeVisible();

  await context.close();
});

test("a checklist item can be deleted and the count updates", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Checklist Del WS ${stamp}`;
  const boardTitle = `Checklist Del Board ${stamp}`;
  const email = `e2e-checklist-del-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Delete Card");

  const dialog = page.getByRole("dialog", { name: "Card details" });
  await page.getByText("Delete Card", { exact: true }).click();
  await expect(dialog).toBeVisible();

  await addChecklistItem(dialog, "Keep me");
  await addChecklistItem(dialog, "Remove me");
  await expect(dialog.getByText("0/2", { exact: true })).toBeVisible();

  // Hover the row so the delete button (group-hover opacity) is visible, then
  // click it. Playwright can click an opacity-0 element, but hovering mirrors
  // the real interaction and is deterministic.
  await dialog.getByText("Remove me", { exact: true }).hover();
  await dialog.getByRole("button", { name: "Delete item Remove me" }).click();

  await expect(dialog.getByText("Remove me", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Keep me", { exact: true })).toBeVisible();
  await expect(dialog.getByText("0/1", { exact: true })).toBeVisible();

  await context.close();
});

test("a checklist item added in one context appears and toggles in another viewing the same card", async ({
  browser,
}) => {
  // The task's acceptance criterion: checklist completion state syncs to other
  // clients viewing the same card. Owner adds/toggles in context A; the member
  // (with the same card's modal open in context B) sees it without a refresh.
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const member = await memberContext.newPage();

  const stamp = Date.now();
  const workspaceName = `Checklist Sync WS ${stamp}`;
  const boardTitle = `Checklist Sync Board ${stamp}`;
  const ownerEmail = `e2e-checklist-owner-${stamp}@example.com`;
  const memberEmail = `e2e-checklist-member-${stamp}@example.com`;

  await signUp(owner, ownerEmail);
  await createWorkspace(owner, workspaceName);
  const code = await generateInvite(owner, workspaceName);

  await openBoardsPage(owner, workspaceName);
  await owner.getByLabel("Board title").fill(boardTitle);
  await owner.getByRole("button", { name: "Create board" }).click();
  await expect(owner.getByText(boardTitle)).toBeVisible();
  await openBoard(owner, boardTitle);
  await addColumn(owner, "To Do");
  await addCard(owner, "Sync Card");

  await signUp(member, memberEmail);
  await member.getByLabel("Invite code").fill(code);
  await member.getByRole("button", { name: "Join workspace" }).click();
  await expect(member.getByText(workspaceName)).toBeVisible();
  await openBoardsPage(member, workspaceName);
  await expect(member.getByText(boardTitle)).toBeVisible();
  await openBoard(member, boardTitle);
  await expect(member.getByText("Sync Card", { exact: true })).toBeVisible();

  // Both open the same card's detail modal before any checklist interaction.
  const ownerDialog = owner.getByRole("dialog", { name: "Card details" });
  const memberDialog = member.getByRole("dialog", { name: "Card details" });
  await owner.getByText("Sync Card", { exact: true }).click();
  await member.getByText("Sync Card", { exact: true }).click();
  await expect(ownerDialog).toBeVisible();
  await expect(memberDialog).toBeVisible();

  // Owner adds an item; the member's open modal must reflect it via Realtime,
  // within a bounded wait and with no manual refresh.
  await ownerDialog.getByLabel("Checklist item", { exact: true }).fill("Shared item");
  await ownerDialog.getByLabel("Checklist item", { exact: true }).press("Enter");
  await expect(ownerDialog.getByText("Shared item", { exact: true })).toBeVisible();

  await expect(
    memberDialog.getByText("Shared item", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(memberDialog.getByText("0/1", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Owner checks the item off; the member's checkbox follows without a refresh.
  await ownerDialog.getByRole("checkbox", { name: "Shared item" }).check();
  await expect(ownerDialog.getByText("1/1", { exact: true })).toBeVisible();

  await expect(
    memberDialog.getByRole("checkbox", { name: "Shared item" }),
  ).toBeChecked({ timeout: 15_000 });
  await expect(memberDialog.getByText("1/1", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await ownerContext.close();
  await memberContext.close();
});