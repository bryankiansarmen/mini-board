import { expect, test } from "@playwright/test";

const password = "correct-horse-battery-staple";

async function signUp(
  page: import("@playwright/test").Page,
  email: string,
) {
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
  await expect(
    page.getByRole("button", { name: "Create board" }),
  ).toBeVisible();
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

async function generateInvite(
  page: import("@playwright/test").Page,
  workspaceName: string,
) {
  await page
    .getByRole("button", { name: `Invite ${workspaceName}` })
    .click();
  const code = await page.getByTestId("invite-code").textContent();
  return code!;
}

test("presence avatars show all three users in real time", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const member1Context = await browser.newContext();
  const member2Context = await browser.newContext();

  const owner = await ownerContext.newPage();
  const member1 = await member1Context.newPage();
  const member2 = await member2Context.newPage();

  const stamp = Date.now();
  const workspaceName = `Presence WS ${stamp}`;
  const boardTitle = `Presence Board ${stamp}`;
  const ownerEmail = `e2e-presence-owner-${stamp}@example.com`;
  const member1Email = `e2e-presence-m1-${stamp}@example.com`;
  const member2Email = `e2e-presence-m2-${stamp}@example.com`;

  // Owner creates workspace and board.
  await signUp(owner, ownerEmail);
  await createWorkspace(owner, workspaceName);
  const code = await generateInvite(owner, workspaceName);
  await openBoardsPage(owner, workspaceName);

  await owner.getByLabel("Board title").fill(boardTitle);
  await owner.getByRole("button", { name: "Create board" }).click();
  await expect(owner.getByText(boardTitle)).toBeVisible();
  await openBoard(owner, boardTitle);

  // Owner should see their own avatar.
  const ownerPresence = owner.getByRole("list", {
    name: "Active users on this board",
  });
  await expect(ownerPresence).toBeVisible({ timeout: 2000 });
  const ownerAvatars = ownerPresence.getByRole("listitem");
  await expect(ownerAvatars).toHaveCount(1);

  // Member 1 joins.
  await signUp(member1, member1Email);
  await member1.getByLabel("Invite code").fill(code);
  await member1.getByRole("button", { name: "Join workspace" }).click();
  await expect(member1.getByText(workspaceName)).toBeVisible();
  await openBoardsPage(member1, workspaceName);
  await openBoard(member1, boardTitle);

  // Both contexts should now show 2 avatars.
  await expect(ownerPresence.getByRole("listitem")).toHaveCount(2, {
    timeout: 2000,
  });
  const member1Presence = member1.getByRole("list", {
    name: "Active users on this board",
  });
  await expect(member1Presence.getByRole("listitem")).toHaveCount(2, {
    timeout: 2000,
  });

  // Member 2 joins.
  await signUp(member2, member2Email);
  await member2.getByLabel("Invite code").fill(code);
  await member2.getByRole("button", { name: "Join workspace" }).click();
  await expect(member2.getByText(workspaceName)).toBeVisible();
  await openBoardsPage(member2, workspaceName);
  await openBoard(member2, boardTitle);

  // All three contexts should show 3 avatars.
  await expect(ownerPresence.getByRole("listitem")).toHaveCount(3, {
    timeout: 2000,
  });
  await expect(member1Presence.getByRole("listitem")).toHaveCount(3, {
    timeout: 2000,
  });
  const member2Presence = member2.getByRole("list", {
    name: "Active users on this board",
  });
  await expect(member2Presence.getByRole("listitem")).toHaveCount(3, {
    timeout: 2000,
  });

  // Owner leaves (closes context).
  await ownerContext.close();

  // Remaining two should see 2 avatars.
  await expect(member1Presence.getByRole("listitem")).toHaveCount(2, {
    timeout: 3000,
  });
  await expect(member2Presence.getByRole("listitem")).toHaveCount(2, {
    timeout: 3000,
  });

  await member1Context.close();
  await member2Context.close();
});
