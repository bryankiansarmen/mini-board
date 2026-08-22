# Keyboard Navigation Manual Test Checklist

**Date**: Sat Aug 22 2026
**Target**: Epic E7-F1-S2-T1 Accessibility Pass
**Standards**: WCAG 2.1 AA Compliance (NFR-4)

## Test Execution Log

### 1. Authentication & Navigation Flow
- [x] Navigate `/login` and `/signup` using `Tab` and `Shift+Tab`. Focus outline visible on all input fields and submit buttons.
- [x] Submitting form via `Enter` key succeeds.
- [x] Navigating workspace list via keyboard `Tab` links works cleanly.

### 2. Board View Keyboard Navigation
- [x] `Tab` key cycles through all interactive elements on the board header (theme toggle, activity feed toggle, presence stack).
- [x] `Tab` key moves focus to cards and columns with visible high-contrast focus rings (`focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]`).
- [x] Focused card responds to `Enter` or `Space` key to open the Card Detail Modal.

### 3. Focus Management & Focus Trap in Modals
- [x] Opening `CardDetailModal` traps keyboard focus inside the modal dialog container.
- [x] `Tab` cycles through editable fields (Title, Description, Due Date, Assignee, Labels, Checklist, Comments, Close button) without focus escaping to background.
- [x] Pressing `Escape` key closes `CardDetailModal` and returns focus to triggering element.
- [x] `DeleteCardModal`, `DeleteColumnModal`, and `DeleteBoardModal` trap focus with default focus on the safe "Cancel" button.

### 4. Keyboard Drag-and-Drop Alternative (Card Move & Column Reorder)
- [x] Card options menu ("⋮" button / `aria-haspopup="menu"`) is accessible via keyboard.
- [x] Pressing `Enter` or `Space` on action button opens dropdown menu.
- [x] `ArrowDown` and `ArrowUp` keys navigate between menu items ("Open details", "Move to [Column]", "Delete card").
- [x] Pressing `Enter` on "Move to [Column]" moves card to target column with optimistic update and focus returned to trigger.
- [x] Column options menu provides keyboard accessible "Move left" and "Move right" actions for column reordering.

### 5. Color Contrast & Accessibility Audit
- [x] `axe-core` scan run on Board View: 0 critical, 0 serious violations.
- [x] `axe-core` scan run on Card Detail Modal: 0 critical, 0 serious violations.
- [x] Overdue due-date chip includes both warning color and overdue text/icon formatting so color is never the sole visual signal.

## Verdict
**PASS** — All WCAG 2.1 AA keyboard accessibility requirements satisfied.
