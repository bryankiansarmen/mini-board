# MiniBoard

A real-time, multi-user Kanban board a lightweight Trello alternative. Create workspaces, invite teammates, build boards with columns, and manage cards that sync live across every connected client. When one person drags a card, everyone watching sees it move within about a second, no refresh required.

The technical centerpiece is **real-time sync with correct concurrent-edit behavior** getting drag-and-drop reordering, optimistic updates, and multi-client reconciliation right.

## Features

MVP scope:

- Email/password + Google OAuth authentication
- Workspace creation and membership via shareable invite code
- Board, column, and card CRUD
- Drag-and-drop reordering within and across columns, synced in real time
- Card detail modal: description, due date, assignee, labels, comments, checklist
- Per-board activity log
- Basic member management (invite, remove, promote/demote admin)
- Live presence avatars (who's viewing the board)

Post-MVP (out of scope): guest/viewer read-only links, email invites, file attachments, @mentions and notifications, board templates, CSV/PDF export, undo/redo for drags.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Client state | Zustand |
| Drag-and-drop | dnd-kit |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Elevated operations | Next.js Route Handlers + Supabase service-role client (server-only) |
| Hosting | Vercel + Supabase (free tier) |

Authorization is enforced by Postgres Row-Level Security not duplicated in application code. The browser client only uses the Supabase anon key; the service-role key exists solely in Route Handlers.

## Getting Started

### Prerequisites

- Node.js 20+ (or the current LTS)
- Docker (for local Supabase)
- A Supabase project (or local Supabase via `supabase start`)

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
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
app/
  page.tsx                  → landing page
  login/ signup/            → auth screens
  workspaces/               → workspace list + membership & member management
  boards/[boardId]/         → the Kanban board (main real-time view)
  api/
    invites/                → invite code generation + redemption (Route Handlers)
    members/[id]/           → member removal (enforces last-owner rule)
components/
  board/                    → Column, Card, CardDetailModal, PresenceStack
  workspace/                → WorkspaceSwitcher, MemberList, InviteDialog
  ui/                       → shared primitives (Button, Modal, Avatar, Input)
lib/
  supabase/                 → client + server Supabase client factories
  store/                    → Zustand slices (board, presence, ui)
  realtime/                 → channel subscription hooks
types/                      → generated Supabase types + domain types
```

## Deployment

Production runs on Vercel (Hobby) with a dedicated Supabase project. Preview deployments point at a separate Supabase dev project so a preview bug can never touch production data. CI/CD (lint → typecheck → tests → Vercel preview → merge → production) is handled by GitHub Actions with automatic Vercel deployments per environment.