# MiniBoard

A real-time, multi-user Kanban board a lightweight Trello alternative. Create workspaces, invite teammates, build boards with columns, and manage cards that sync live across every connected client. When one person drags a card, everyone watching sees it move within about a second, no refresh required.

The technical centerpiece is **real-time sync with correct concurrent-edit behavior** getting drag-and-drop reordering, optimistic updates, and multi-client reconciliation right.

## Features

MVP scope:

- Email/password + Google OAuth authentication
- Workspace creation and membership via shareable invite code
- Board, column, and card CRUD
- Drag-and-drop reordering within and across columns with optimistic updates and fractional position re-normalization
- Real-time synchronization via Postgres Changes subscriptions
- Card detail modal: title, description, due date, assignee, labels, comments, and checklist items
- Per-board activity log tracking card and column actions with live updates
- Live presence avatars showing connected users per board
- Basic member management (invite, remove, promote/demote admin)
- Accessibility pass: focus trap management, keyboard navigation (move left/right/up/down), ARIA roles, and high contrast focus indicators
- Design token system with light/dark theme toggle and OS system preference detection

Post-MVP (out of scope): guest/viewer read-only links, email invites, file attachments, @mentions and notifications, board templates, CSV/PDF export, undo/redo for drags.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS (v4) with CSS custom properties design tokens |
| Client state | Zustand |
| Drag-and-drop | dnd-kit |
| Accessibility | focus-trap-react, axe-core |
| Testing | Vitest (unit & integration), Playwright (E2E) |
| Backend | Supabase (Postgres, Auth, Realtime) |
| Elevated operations | Next.js Route Handlers + Supabase service-role client (server-only) |
| Hosting | Vercel + Supabase |

Authorization is enforced by Postgres Row-Level Security not duplicated in application code. The browser client only uses the Supabase anon key; the service-role key exists solely in Route Handlers.

## Getting Started

### Prerequisites

- Node.js 20+ (or the current LTS)
- Docker (for local Supabase)
- A Supabase project (or local Supabase via `npx supabase start`)

### Setup

```bash
# Install dependencies
npm install

# Install and start local Supabase (requires Docker running)
npx supabase init
npx supabase start

# Initialize Playwright browsers (for e2e tests)
npx playwright install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<local supabase url, printed by `supabase start`>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
SUPABASE_SERVICE_ROLE_KEY=<local service role key>   # server-only, never exposed to the browser
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint check |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:unit` | Run unit test suite |
| `npm run test:integration` | Run database integration tests with Vitest against local Supabase |
| `npm run test:e2e` | Run end-to-end browser tests with Playwright |

## Project Structure

```
app/
  page.tsx                  → landing page
  login/ signup/            → auth screens
  workspaces/               → workspace list, board creation, & member management
  boards/[boardId]/         → the Kanban board (main real-time view)
  api/
    invites/                → invite code generation & redemption (Route Handlers)
    members/                → member management & removal (Route Handlers)
components/
  board/                    → Column, Card, CardDetailModal, PresenceStack, ActivityFeed, CardMenu, ColumnMenu
  workspace/                → MemberList, InviteButton, CreateWorkspaceForm, JoinWorkspaceForm
  theme-toggle.tsx          → dark mode theme toggle component
lib/
  activity/                 → activity logging service & message formatters
  checklist/                → checklist service & server actions
  comments/                 → comment service & server actions
  cards/                    → card service, date utilities, position calculations & server actions
  columns/                  → column actions & position calculations
  members/                  → member management service
  shared/                   → position drift detection & re-normalization helpers
  theme/                    → useTheme hook with dark mode & system preference support
  realtime/                 → channel subscription hooks & state reconciliation
  supabase/                 → client, server, & service-role Supabase client factories
  store/                    → Zustand slice (board state & optimistic moves)
tests/
  unit/                     → unit test suites (store, dates, position, drift, formatting, codes)
  integration/              → database integration test suites with RLS negative coverage
  e2e/                      → Playwright end-to-end browser test suites
types/                      → domain types mirroring Supabase schema
```

## Testing & Quality Verification

Local verification is enforced before merging or deploying:

- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration` (tests RLS policies & service queries against local Supabase)
- **E2E tests**: `npm run test:e2e` (automated accessibility & Playwright user flows)
- **Linting & Types**: `npm run lint` && `npm run typecheck`

## Deployment

Production runs on Vercel with a dedicated Supabase project. Preview deployments point at a separate Supabase dev project so a preview bug can never touch production data. Deployment pushes and migrations are verified through local test suites before release.