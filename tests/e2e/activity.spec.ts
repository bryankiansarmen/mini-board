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
  const link = page
    .getByRole("link", { name: new RegExp(workspaceName) });
  await link.waitFor({ state: "visible" });
  await link.click();
  await expect(page).toHaveURL(/\/workspaces\/.+\/boards/, { timeout: 10000 });
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

test("activity feed shows entries after card and column actions", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Activity WS ${stamp}`;
  const boardTitle = `Activity Board ${stamp}`;
  const email = `e2e-activity-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Alpha Card");
  await addCard(page, "Beta Card");

  // Open activity feed.
  await page.getByRole("button", { name: "Activity" }).click();
  const feed = page.getByRole("complementary", { name: "Activity feed" });
  await expect(feed).toBeVisible();

  // Wait for activity entries to appear (Realtime may take a moment).
  const feedList = feed.getByRole("log", { name: "Activity feed" });
  await expect(feedList.getByText("created").first()).toBeVisible({ timeout: 15_000 });

  // Verify at least 2 activity entries exist (column + card creates).
  const count = await feedList.locator("li").count();
  expect(count).toBeGreaterThanOrEqual(2);

  await context.close();
});

test("activity feed persists across a hard reload", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Activity Reload WS ${stamp}`;
  const boardTitle = `Activity Reload Board ${stamp}`;
  const email = `e2e-activity-reload-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "In Progress");
  await addCard(page, "Reload Card");

  // Open activity feed.
  await page.getByRole("button", { name: "Activity" }).click();
  const feed = page.getByRole("complementary", { name: "Activity feed" });
  await expect(feed).toBeVisible();

  // Wait for at least one entry.
  await expect(
    feed.getByRole("log", { name: "Activity feed" }).getByText("created").first(),
  ).toBeVisible({ timeout: 15_000 });

  // Close and reload.
  await page.getByRole("button", { name: "Close activity feed" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();

  // Reopen activity feed; entries should persist.
  await page.getByRole("button", { name: "Activity" }).click();
  const reloadedFeed = page.getByRole("complementary", { name: "Activity feed" });
  await expect(reloadedFeed).toBeVisible();
  await expect(
    reloadedFeed.getByRole("log", { name: "Activity feed" }).getByText("created").first(),
  ).toBeVisible({ timeout: 15_000 });

  await context.close();
});

test("activity feed syncs in real time across two browser contexts", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const member = await memberContext.newPage();

  const stamp = Date.now();
  const workspaceName = `Activity Sync WS ${stamp}`;
  const boardTitle = `Activity Sync Board ${stamp}`;
  const ownerEmail = `e2e-activity-owner-${stamp}@example.com`;
  const memberEmail = `e2e-activity-member-${stamp}@example.com`;

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

  // Open owner's activity feed.
  await owner.getByRole("button", { name: "Activity" }).click();
  const ownerFeed = owner.getByRole("complementary", { name: "Activity feed" });
  await expect(ownerFeed).toBeVisible();

  // Sign in the member and join the workspace.
  await signUp(member, memberEmail);
  await member.getByLabel("Invite code").fill(code);
  await member.getByRole("button", { name: "Join workspace" }).click();
  await expect(member.getByText(workspaceName)).toBeVisible();
  await openBoardsPage(member, workspaceName);
  await expect(member.getByText(boardTitle)).toBeVisible();
  await openBoard(member, boardTitle);
  await expect(member.getByText("Sync Card", { exact: true })).toBeVisible();

  // Open member's activity feed.
  await member.getByRole("button", { name: "Activity" }).click();
  const memberFeed = member.getByRole("complementary", { name: "Activity feed" });
  await expect(memberFeed).toBeVisible();

  // Owner adds a new card. The member's feed should show it via Realtime.
  await addCard(owner, "New Sync Card");

  const memberFeedList = memberFeed.getByRole("log", { name: "Activity feed" });
  await expect(
    memberFeedList.getByText("created").last(),
  ).toBeVisible({ timeout: 15_000 });

  await ownerContext.close();
  await memberContext.close();
});
