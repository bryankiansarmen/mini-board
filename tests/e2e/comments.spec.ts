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

// Locates the comment row containing `body` so its controls can be scoped
// (several "Delete comment" buttons can coexist in the thread).
function commentRow(dialog: import("@playwright/test").Locator, body: string) {
  return dialog
    .getByText(body, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'group')]");
}

// Adds a comment through the card detail modal and waits for it to render.
async function addComment(
  dialog: import("@playwright/test").Locator,
  body: string,
) {
  await dialog.getByLabel("Add comment", { exact: true }).fill(body);
  await dialog.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(dialog.getByText(body, { exact: true })).toBeVisible();
}

test("comments persist across a reload", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Comments WS ${stamp}`;
  const boardTitle = `Comments Board ${stamp}`;
  const email = `e2e-comments-persist-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Comment Card");

  const dialog = page.getByRole("dialog", { name: "Card details" });
  await page.getByText("Comment Card", { exact: true }).click();
  await expect(dialog).toBeVisible();

  await addComment(dialog, "Alpha comment");
  await addComment(dialog, "Beta comment");

  // Close, hard reload, reopen: both comments persist.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();

  await page.getByText("Comment Card", { exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Alpha comment", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Beta comment", { exact: true })).toBeVisible();

  await context.close();
});

test("a comment can be deleted by its author", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Comments Del WS ${stamp}`;
  const boardTitle = `Comments Del Board ${stamp}`;
  const email = `e2e-comments-del-${stamp}@example.com`;

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

  await addComment(dialog, "Keep me");
  await addComment(dialog, "Remove me");

  // Hover the row so the delete button (group-hover opacity) is visible, then
  // click it scoped to the comment's own row.
  await dialog.getByText("Remove me", { exact: true }).hover();
  await commentRow(dialog, "Remove me")
    .getByRole("button", { name: "Delete comment" })
    .click();

  await expect(dialog.getByText("Remove me", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Keep me", { exact: true })).toBeVisible();

  await context.close();
});

test("a comment added in one context appears in another, and only its author can delete it", async ({
  browser,
}) => {
  // The task's acceptance criterion: a user can delete their own comment but
  // not another user's (per RLS policy). Owner adds a comment in context A;
  // the member (with the same card's modal open in context B) sees it without
  // a refresh and has no delete affordance on it, while their own comment
  // remains deletable.
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const member = await memberContext.newPage();

  const stamp = Date.now();
  const workspaceName = `Comments Sync WS ${stamp}`;
  const boardTitle = `Comments Sync Board ${stamp}`;
  const ownerEmail = `e2e-comments-owner-${stamp}@example.com`;
  const memberEmail = `e2e-comments-member-${stamp}@example.com`;

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

  const ownerDialog = owner.getByRole("dialog", { name: "Card details" });
  const memberDialog = member.getByRole("dialog", { name: "Card details" });
  await owner.getByText("Sync Card", { exact: true }).click();
  await member.getByText("Sync Card", { exact: true }).click();
  await expect(ownerDialog).toBeVisible();
  await expect(memberDialog).toBeVisible();

  // Owner adds a comment; the member's open modal must reflect it via
  // Realtime, within a bounded wait and with no manual refresh.
  await ownerDialog.getByLabel("Add comment", { exact: true }).fill("Owner's comment");
  await ownerDialog.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(ownerDialog.getByText("Owner's comment", { exact: true })).toBeVisible();

  const ownerComment = commentRow(memberDialog, "Owner's comment");
  await expect(ownerComment).toBeVisible({ timeout: 15_000 });

  // The member cannot delete the owner's comment: no delete button on that row.
  await expect(
    ownerComment.getByRole("button", { name: "Delete comment" }),
  ).toHaveCount(0);

  // The member's own comment is deletable, and the owner sees it appear and
  // disappear in real time.
  await memberDialog.getByLabel("Add comment", { exact: true }).fill("Member's comment");
  await memberDialog.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(
    ownerDialog.getByText("Member's comment", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  await memberDialog.getByText("Member's comment", { exact: true }).hover();
  await commentRow(memberDialog, "Member's comment")
    .getByRole("button", { name: "Delete comment" })
    .click();

  await expect(
    memberDialog.getByText("Member's comment", { exact: true }),
  ).toHaveCount(0);
  await expect(
    ownerDialog.getByText("Member's comment", { exact: true }),
  ).toHaveCount(0, { timeout: 15_000 });
  // The owner's comment survives the member's deletions.
  await expect(ownerDialog.getByText("Owner's comment", { exact: true })).toBeVisible();

  await ownerContext.close();
  await memberContext.close();
});