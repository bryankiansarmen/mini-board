import { expect, test } from "@playwright/test";

const password = "correct-horse-battery-staple";

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

test("column order persists exactly after creating three columns and reloading", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cols WS ${stamp}`;
  const boardTitle = `Cols Board ${stamp}`;
  const email = `e2e-cols-order-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);

  // Create three columns in a known order.
  await addColumn(page, "To Do");
  await addColumn(page, "Doing");
  await addColumn(page, "Done");

  // The columns render in the order they were created.
  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["To Do", "Doing", "Done"]);

  // Hard reload — order must persist exactly.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
  const headingsAfter = page.getByRole("heading", { level: 3 });
  await expect(headingsAfter).toHaveText(["To Do", "Doing", "Done"]);

  await context.close();
});

test("column can be dragged to reorder and the order survives a reload", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cols WS ${stamp}`;
  const boardTitle = `Cols Board ${stamp}`;
  const email = `e2e-cols-drag-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "To Do");
  await addColumn(page, "Doing");
  await addColumn(page, "Done");

  // Drag "Doing" onto "To Do" — it should move to the front.
  // Explicit mouse gestures rather than dragTo so dnd-kit's PointerSensor
  // sees the intermediate pointermove steps.
  const doing = page.getByRole("heading", { level: 3, name: "Doing" });
  const toDo = page.getByRole("heading", { level: 3, name: "To Do" });
  const doingBox = await doing.boundingBox();
  const toDoBox = await toDo.boundingBox();
  expect(doingBox).not.toBeNull();
  expect(toDoBox).not.toBeNull();
  await page.mouse.move(doingBox!.x + doingBox!.width / 2, doingBox!.y + 10);
  await page.mouse.down();
  await page.mouse.move(
    toDoBox!.x + toDoBox!.width / 2,
    toDoBox!.y + toDoBox!.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();

  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["Doing", "To Do", "Done"]);

  // Persisted after a hard reload.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
  const headingsAfter = page.getByRole("heading", { level: 3 });
  await expect(headingsAfter).toHaveText(["Doing", "To Do", "Done"]);

  await context.close();
});

test("column can be renamed on double-click and deleted via confirm modal", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const stamp = Date.now();
  const workspaceName = `Cols WS ${stamp}`;
  const boardTitle = `Cols Board ${stamp}`;
  const email = `e2e-cols-crud-${stamp}@example.com`;

  await signUp(page, email);
  await createWorkspace(page, workspaceName);
  await openBoardsPage(page, workspaceName);

  await page.getByLabel("Board title").fill(boardTitle);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByText(boardTitle)).toBeVisible();

  await openBoard(page, boardTitle);
  await addColumn(page, "Ideas");

  // Rename on double-click.
  await page.getByRole("heading", { level: 3, name: "Ideas" }).dblclick();
  const renameInput = page.getByLabel("Rename column");
  await expect(renameInput).toBeVisible();
  await renameInput.fill("Backlog");
  await renameInput.press("Enter");
  await expect(
    page.getByRole("heading", { level: 3, name: "Backlog" }),
  ).toBeVisible();

  // Delete via the custom confirmation modal.
  await page
    .getByRole("button", { name: "Delete Backlog", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Delete column?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete column" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Backlog" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No columns yet — create one above."),
  ).toBeVisible();

  await context.close();
});
