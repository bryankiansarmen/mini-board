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
  // finishes. Wait for the form's pending state to settle (button back to
  // "Create column") so the next addColumn doesn't click a disabled button.
  await expect(
    page.getByRole("button", { name: "Create column" }),
  ).toBeEnabled();
}

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

async function joinWithInvite(
  page: import("@playwright/test").Page,
  code: string,
  workspaceName: string,
) {
  await page.getByLabel("Invite code").fill(code);
  await page.getByRole("button", { name: "Join workspace" }).click();
  await expect(page.getByText(workspaceName)).toBeVisible();
}

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

async function columnCardTitles(
  page: import("@playwright/test").Page,
  heading: string,
) {
  const columnRoot = page
    .getByRole("heading", { level: 3, name: heading })
    .locator("xpath=ancestor::div[contains(@class, 'w-72')]");
  return columnRoot.locator("p.text-sm");
}

// Waits until the board's Realtime channel reports SUBSCRIBED. This is the
// readiness signal: without a live subscription, a two-context assertion would
// pass for the wrong reason (a manual refresh) or flake on connection setup.
async function waitForRealtime(page: import("@playwright/test").Page) {
  await expect(page.locator('[data-realtime="SUBSCRIBED"]')).toBeVisible({
    timeout: 15_000,
  });
}

// Sets up owner + member contexts on a shared board with the given columns.
async function setupSharedBoard(
  browser: import("@playwright/test").Browser,
  stamp: number,
  columnTitles: string[],
) {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const member = await memberContext.newPage();

  const workspaceName = `Realtime WS ${stamp}`;
  const boardTitle = `Realtime Board ${stamp}`;
  const ownerEmail = `e2e-realtime-owner-${stamp}@example.com`;
  const memberEmail = `e2e-realtime-member-${stamp}@example.com`;

  await signUp(owner, ownerEmail);
  await createWorkspace(owner, workspaceName);
  const code = await generateInvite(owner, workspaceName);

  await openBoardsPage(owner, workspaceName);
  await owner.getByLabel("Board title").fill(boardTitle);
  await owner.getByRole("button", { name: "Create board" }).click();
  await expect(owner.getByText(boardTitle)).toBeVisible();

  await openBoard(owner, boardTitle);
  for (const title of columnTitles) {
    await addColumn(owner, title);
  }

  await signUp(member, memberEmail);
  await joinWithInvite(member, code, workspaceName);
  await openBoardsPage(member, workspaceName);
  await expect(member.getByText(boardTitle)).toBeVisible();
  await openBoard(member, boardTitle);

  await waitForRealtime(owner);
  await waitForRealtime(member);

  return { owner, member, ownerContext, memberContext, boardTitle };
}

test("card moved in context A appears moved in context B with no duplication or loss", async ({
  browser,
}) => {
  const stamp = Date.now();
  const { owner, member, ownerContext, memberContext } = await setupSharedBoard(
    browser,
    stamp,
    ["To Do", "Done"],
  );

  await addCardInColumn(owner, "To Do", "Sync Me");

  // Member sees the card too.
  await expect(member.getByText("Sync Me", { exact: true })).toBeVisible();

  // Set up the response waiter BEFORE the drag so the POST is captured.
  const moveResponse = waitForMoveResponse(owner);

  await dragCardToColumn(owner, "Sync Me", "Done");
  await moveResponse;

  // Owner's own board reflects the move (optimistic + server).
  await expect(await columnCardTitles(owner, "Done")).toHaveText(["Sync Me"]);
  await expect(await columnCardTitles(owner, "To Do")).toHaveText([]);

  // THE DoD assertion: context B sees the moved card within a bounded wait —
  // no duplication, no loss. This is the project's most important test.
  await expect(await columnCardTitles(member, "Done")).toHaveText(["Sync Me"], {
    timeout: 15_000,
  });
  await expect(await columnCardTitles(member, "To Do")).toHaveText([]);
  await expect(member.getByText("Sync Me", { exact: true })).toHaveCount(1);

  // Still consistent after a hard reload (server truth agrees with Realtime).
  await member.reload();
  await expect(
    member.getByRole("button", { name: "Create column" }),
  ).toBeVisible();
  await expect(await columnCardTitles(member, "Done")).toHaveText(["Sync Me"]);
  await expect(member.getByText("Sync Me", { exact: true })).toHaveCount(1);

  await ownerContext.close();
  await memberContext.close();
});

test("concurrent drags of the same card converge to a single consistent state in both contexts", async ({
  browser,
}) => {
  const stamp = Date.now();
  const { owner, member, ownerContext, memberContext } = await setupSharedBoard(
    browser,
    stamp,
    ["To Do", "Doing", "Done"],
  );

  await addCardInColumn(owner, "To Do", "Race Card");
  await expect(member.getByText("Race Card", { exact: true })).toBeVisible();

  // Drag the same card in both contexts within the same second, to different
  // columns. The last committed write wins; both clients must converge on the
  // same final position — never two different positions, never a duplicate.
  const ownerMove = waitForMoveResponse(owner);
  const memberMove = waitForMoveResponse(member);

  await dragCardToColumn(owner, "Race Card", "Doing");
  await dragCardToColumn(member, "Race Card", "Done");

  await Promise.all([ownerMove, memberMove]);

  // Poll until both contexts agree on the same column and no card is lost or
  // duplicated. Each side independently converges via Realtime reconciliation.
  const columnNames = ["To Do", "Doing", "Done"];
  await expect
    .poll(
      async () => {
        const readTitles = async (page: import("@playwright/test").Page) => {
          const titles: Record<string, string[]> = {};
          for (const name of columnNames) {
            titles[name] = (
              await (await columnCardTitles(page, name)).allTextContents()
            ).filter(Boolean);
          }
          return titles;
        };

        const ownerTitles = await readTitles(owner);
        const memberTitles = await readTitles(member);

        // Find which column holds the card in each context (exactly one).
        const find = (titles: Record<string, string[]>) =>
          columnNames.find((column) => titles[column].includes("Race Card")) ??
          null;

        const ownerColumn = find(ownerTitles);
        const memberColumn = find(memberTitles);

        if (!ownerColumn || ownerColumn !== memberColumn) return false;

        // No duplication or loss: exactly one card total, in one column.
        const ownerCount = ownerTitles[ownerColumn].filter(
          (t) => t === "Race Card",
        ).length;
        const memberCount = memberTitles[memberColumn].filter(
          (t) => t === "Race Card",
        ).length;
        return ownerCount === 1 && memberCount === 1;
      },
      { timeout: 15_000, intervals: [500] },
    )
    .toBe(true);

  await ownerContext.close();
  await memberContext.close();
});
