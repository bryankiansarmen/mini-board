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
}

async function addCard(page: import("@playwright/test").Page, title: string) {
  await page.getByLabel("Card title").fill(title);
  await page.getByRole("button", { name: "+ Add card" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

// Fills the "Card title" input inside a specific column. Needed once a board
// has more than one column (getByLabel("Card title") would be ambiguous).
async function addCardInColumn(
  page: import("@playwright/test").Page,
  columnHeading: string,
  title: string,
) {
  const columnRoot = page
    .getByRole("heading", { level: 3, name: columnHeading })
    .locator("xpath=ancestor::div[contains(@class, 'w-72')]");
  await columnRoot.getByLabel("Card title").fill(title);
  await columnRoot.getByRole("button", { name: "+ Add card" }).click();
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

// Waits for the board server action (moveCard) to commit before returning.
// Without this, a hard reload right after a drag races the async DB write and
// the reload can render stale positions (flaky under parallel workers).
async function waitForMoveResponse(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.request().headers()["next-action"] !== undefined &&
      response.url().includes("/boards/"),
  );
}

async function dragCardToColumn(
  page: import("@playwright/test").Page,
  cardTitle: string,
  targetHeading: string,
) {
  // Explicit mouse gestures rather than dragTo so dnd-kit's PointerSensor
  // sees the intermediate pointermove steps (same approach as columns.spec.ts).
  const card = page.getByText(cardTitle, { exact: true });
  const target = page.getByRole("heading", { level: 3, name: targetHeading });
  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
}

// Cards inside a single column, scoped via the column root (a w-72 div that
// also contains the column's h3 heading). The loose space-y-2 locator used in
// the order tests matches cards across every column, which is wrong once a
// board has more than one column.
async function columnCardTitles(
  page: import("@playwright/test").Page,
  heading: string,
) {
  const columnRoot = page
    .getByRole("heading", { level: 3, name: heading })
    .locator("xpath=ancestor::div[contains(@class, 'w-72')]");
  return columnRoot.locator("p.text-sm");
}

test("card can be dragged between columns and the move persists after a reload", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-drag-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addColumn(page, "Done");

  await addCardInColumn(page, "To Do", "Drag Me");
  await addCardInColumn(page, "To Do", "Keep Me");

  // Set up the response waiter BEFORE the drag so the POST is captured.
  const moveResponse = waitForMoveResponse(page);

  // Drag the card from "To Do" onto the "Done" column.
  await dragCardToColumn(page, "Drag Me", "Done");

  // Wait for the server action to commit so the reload can't race it.
  await moveResponse;

  await expect(await columnCardTitles(page, "Done")).toHaveText(["Drag Me"]);
  await expect(await columnCardTitles(page, "To Do")).toHaveText(["Keep Me"]);

  // Persisted after a hard reload.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
  await expect(await columnCardTitles(page, "Done")).toHaveText(["Drag Me"]);
  await expect(await columnCardTitles(page, "To Do")).toHaveText(["Keep Me"]);

  await context.close();
});

test("a failed card move rolls back and shows a toast", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-rollback-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addColumn(page, "Done");
  await addCardInColumn(page, "To Do", "Sticky Card");

  // Make the moveCard server action (a POST carrying the Next-Action header to
  // the board URL) fail. The optimistic update must roll back and a toast must
  // appear, never a silent failure.
  await page.route(/\/boards\/.+/, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await dragCardToColumn(page, "Sticky Card", "Done");

  // Card rolled back to its original column.
  await expect(await columnCardTitles(page, "To Do")).toHaveText(["Sticky Card"]);
  await expect(await columnCardTitles(page, "Done")).toHaveText([]);

  // Error toast surfaced. (Scoped by text: Next.js also injects a route
  // announcer with role="alert".)
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't move card" }),
  ).toBeVisible();

  await context.close();
});

test("card can be created, renamed on double-click, and deleted", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-crud-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");

  // Create a card inside the column.
  await addCard(page, "Fix the bug");

  // The column's count badge reflects the new card.
  await expect(page.getByText("Fix the bug", { exact: true })).toBeVisible();

  // Rename on double-click.
  await page.getByText("Fix the bug", { exact: true }).dblclick();
  const renameInput = page.getByLabel("Rename card");
  await expect(renameInput).toBeVisible();
  await renameInput.fill("Fix the critical bug");
  await renameInput.press("Enter");
  await expect(
    page.getByText("Fix the critical bug", { exact: true }),
  ).toBeVisible();

  // Delete via the custom confirmation modal.
  await page
    .getByRole("button", { name: "Delete Fix the critical bug" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Delete card?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete card" }).click();
  await expect(
    page.getByText("Fix the critical bug", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Drop cards here")).toBeVisible();

  await context.close();
});

test("card order persists exactly after creating three cards and reloading", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-order-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "Backlog");

  await addCard(page, "Card One");
  await addCard(page, "Card Two");
  await addCard(page, "Card Three");

  // Hard reload; order must persist exactly (validates position handling).
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();

  const cardList = page.locator('div[class*="space-y-2"] p.text-sm');
  await expect(cardList).toHaveText(["Card One", "Card Two", "Card Three"]);

  await context.close();
});

test("card detail modal opens on a single click and closes via Escape, backdrop, and Close", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-modal-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Modal Card");

  const dialog = page.getByRole("dialog", { name: "Card details" });

  // A single click opens the detail modal (delayed 250ms to distinguish a
  // single click from a double-click rename).
  await page.getByText("Modal Card", { exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByLabel("Card title").first(),
  ).toHaveValue("Modal Card");
  await expect(
    dialog.getByRole("button", { name: "Add a description…" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Set due date" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Assign" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "+ Label" })).toBeVisible();

  // Escape closes.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Backdrop click closes.
  await page.getByText("Modal Card", { exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);

  // Close button closes.
  await page.getByText("Modal Card", { exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);

  await context.close();
});

test("card detail fields save independently and persist after a reload", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards WS ${stamp}`;
  const boardTitle = `Cards Board ${stamp}`;
  const email = `e2e-cards-details-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addCard(page, "Edit Me");

  const dialog = page.getByRole("dialog", { name: "Card details" });

  await page.getByText("Edit Me", { exact: true }).click();
  await expect(dialog).toBeVisible();

  // Description: the dashed "Add a description…" button becomes a textarea;
  // blurring saves. The display text only reappears after the save commits.
  await dialog.getByRole("button", { name: "Add a description…" }).click();
  const descriptionInput = dialog.getByLabel("Card description");
  await descriptionInput.fill("Build the thing");
  await descriptionInput.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Build the thing" }),
  ).toBeVisible();

  // Due date: a future date in the current year (formatDueDate drops the year
  // for current-year dates, and avoiding an overdue date skips the amber chip).
  // Blur via a click on the title input: Tab on a native date input cycles its
  // internal segments in Chromium before leaving the control, so blur is not
  // deterministic under Playwright.
  await dialog.getByRole("button", { name: "Set due date" }).click();
  const dueDateInput = dialog.getByLabel("Due date");
  await dueDateInput.fill("2026-12-15");
  await dialog.getByLabel("Card title").first().click();
  await expect(
    dialog.getByRole("button", { name: "Dec 15" }),
  ).toBeVisible();

  // Label: add via the "+ Label" input; Enter adds and saves.
  await dialog.getByRole("button", { name: "+ Label" }).click();
  const labelInput = dialog.getByLabel("Add label");
  await labelInput.fill("frontend");
  await labelInput.press("Enter");
  await expect(dialog.getByText("frontend", { exact: true })).toBeVisible();

  // Assignee: the owner is a workspace member and appears in the picker.
  await dialog.getByRole("button", { name: "Assign" }).click();
  await dialog.getByLabel("Assignee").selectOption(email);
  await expect(dialog.getByText(email, { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);

  // The card list shows the metadata.
  await expect(page.getByText("frontend", { exact: true })).toBeVisible();
  await expect(page.getByText("Dec 15", { exact: true })).toBeVisible();
  await expect(page.getByTitle(email)).toBeVisible();

  // Everything survives a hard reload.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
  await expect(page.getByText("frontend", { exact: true })).toBeVisible();
  await expect(page.getByText("Dec 15", { exact: true })).toBeVisible();
  await expect(page.getByTitle(email)).toBeVisible();

  // Reopen and confirm every field still holds its value.
  await page.getByText("Edit Me", { exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Build the thing" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Dec 15" }),
  ).toBeVisible();
  await expect(dialog.getByText("frontend", { exact: true })).toBeVisible();
  await expect(dialog.getByText(email, { exact: true })).toBeVisible();

  await context.close();
});

test("a plain member sees cards in a shared board, a non-member does not", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  const stamp = Date.now();
  const workspaceName = `Cards View WS ${stamp}`;
  const boardTitle = `Cards Shared Board ${stamp}`;
  const emailA = `e2e-cards-v-a-${stamp}@example.com`;
  const emailB = `e2e-cards-v-b-${stamp}@example.com`;
  const emailC = `e2e-cards-v-c-${stamp}@example.com`;

  // Owner A creates workspace + board + column + card, and an invite code.
  await signUp(pageA, emailA);
  await createWorkspace(pageA, workspaceName);

  const code = await generateInvite(pageA, workspaceName);

  await openBoardsPage(pageA, workspaceName);
  await pageA.getByLabel("Board title").fill(boardTitle);
  await pageA.getByRole("button", { name: "Create board" }).click();
  await expect(pageA.getByText(boardTitle)).toBeVisible();
  await openBoard(pageA, boardTitle);
  await addColumn(pageA, "To Do");
  await addCard(pageA, "Shared Card");

  // Non-member C, a completely unrelated user, never reaches the board:
  // the board page 404s because RLS returns no board row for them.
  await signUp(pageC, emailC);
  await pageC.goto(pageA.url());
  await expect(pageC.getByText(boardTitle, { exact: true })).toHaveCount(0);

  // Member B joins via the invite code and sees the board and its card.
  await signUp(pageB, emailB);
  await pageB.getByLabel("Invite code").fill(code);
  await pageB.getByRole("button", { name: "Join workspace" }).click();
  await expect(pageB.getByText(workspaceName)).toBeVisible();

  await openBoardsPage(pageB, workspaceName);
  await expect(pageB.getByText(boardTitle)).toBeVisible();
  await openBoard(pageB, boardTitle);
  await expect(pageB.getByText("Shared Card", { exact: true })).toBeVisible();

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
