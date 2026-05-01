# GroupTab — Project Documentation
> Updated: 2026-05-01 (Session 2)

---

## 1. Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Vanilla CSS + Tailwind utilities |
| Backend | Supabase (Postgres + Realtime + Storage + Auth) |
| Push Notifications | Web Push API (VAPID) |
| OCR | Custom `/api/ocr` route (Vision API) |
| Deployment | Vercel |

---

## 2. Architecture Overview

```
app/
├── (app)/                    # Authenticated routes (layout with auth guard)
│   ├── groups/               # Group list + join by code
│   ├── groups/[groupId]/     # Chat feed (main)
│   │   ├── balances/         # Per-group settle up + debt breakdown
│   │   ├── receipt/[id]/     # OCR receipt review + split
│   │   ├── recurring/        # Recurring payment schedules
│   │   └── settings/         # Group settings + leave/delete
│   ├── balances/             # Global balances across all groups (batch-optimized)
│   ├── statistics/           # Personal expense stats by category
│   └── profile/              # User profile settings
├── join/[inviteCode]/        # Public join page
├── login/ register/          # Auth pages
└── api/
    ├── push/notify           # Send push to group members
    ├── push/remind-debt      # Send push to specific debtor
    ├── push/subscribe        # Register push subscription
    ├── ocr/                  # Receipt OCR extraction
    └── add-member/           # Add member to group

hooks/
├── useGroupChat.ts           # Realtime messages, send, sendImage
├── useGroupBalances.ts       # Realtime balance calculation + settlements
├── useExpense.ts             # CRUD expense
├── useSettlement.ts          # Mark paid + confirm received
├── useRemindDebtor.ts        # Rate-limited debt reminders (localStorage)
└── usePushNotifications.ts   # Web Push subscribe/unsubscribe

components/
├── feed/
│   ├── MessageBubble.tsx     # Text + image messages
│   ├── ExpenseBubble.tsx     # Expense card with Pay Now, Edit, Delete
│   ├── SettlementBubble.tsx  # Settlement card with Confirm Payment
│   └── ReceiptBubble.tsx     # Receipt scan card
├── group/
│   ├── ChatHeader.tsx        # Nav header
│   └── ExpenseModal.tsx      # Add/Edit expense form
├── balances/
│   ├── DebtCard.tsx          # Debt row with expandable breakdown + actions
│   └── PendingDebtCard.tsx   # Amber pending-only card
├── receipt/
│   └── ItemCard.tsx          # Receipt item assignment
└── ui/
    ├── Avatar.tsx            # User avatar with initials fallback
    └── Logo.tsx              # App logo

lib/
├── types.ts                  # All TypeScript types
├── utils.ts                  # formatCurrency, calculateBalances, simplifyDebts,
│                             # pushGroupNotify, getRateLimitState, incrementRateLimit,
│                             # getDebtBreakdown, DebtBreakdownItem
└── supabase/
    ├── client.ts             # Supabase client singleton
    └── queries.ts            # Centralized DB query functions
```

---

## 3. Database Schema (10 migrations applied)

| Table | Key Columns |
|---|---|
| `profiles` | id, name, email, avatar_url |
| `groups` | id, name, description, avatar_url, invite_code, created_by |
| `group_members` | group_id, user_id, role (admin/member), joined_at |
| `messages` | group_id, sender_id, type, content, metadata (jsonb) |
| `expenses` | group_id, paid_by, description, total_amount, category |
| `expense_shares` | expense_id, user_id, amount |
| `settlements` | group_id, from_user, to_user, amount, status (pending/completed) |
| `receipts` | group_id, uploaded_by, image_url, merchant_name, ocr_data, status |
| `receipt_items` | receipt_id, name, price, quantity |
| `receipt_item_assignments` | receipt_item_id, user_id, amount |
| `recurring_payments` | group_id, title, amount, frequency, next_due_date, involved_members |
| `push_subscriptions` | user_id, endpoint, keys |

> [!IMPORTANT]
> `010_group_delete_policy.sql` must be applied manually in Supabase Dashboard → SQL Editor for admin Delete Group to work.

---

## 4. ✅ Features Completed

### Authentication
- [x] Email/password sign up + sign in
- [x] Google OAuth
- [x] Auth callback handling

### Groups
- [x] Create group (name, description, avatar)
- [x] Group list sorted by **last message date** with message preview
- [x] Join group via invite link (`/join/{code}`)
- [x] Join group via code entry (modal with # icon)
- [x] Invite link copy in settings
- [x] Leave group (with admin transfer to next member)
- [x] Delete group — admin only (requires `010` migration applied)
- [x] Edit group name + description
- [x] Upload group avatar
- [x] Role-based access (admin vs member)

### Chat Feed
- [x] Real-time text messages (Supabase Realtime)
- [x] Optimistic UI for send + image
- [x] Paginated message history (30/page, load more on scroll)
- [x] Refetch on tab focus / visibility change
- [x] @mention autocomplete with keyboard navigation
- [x] Image send (from gallery, paste from clipboard, iOS sticker)
- [x] Receipt scan (camera → OCR → review)
- [x] Message grouping (avatar/name shown only at block start/end)

### Expenses
- [x] Add expense: description, category, amount, paid by, split between
- [x] Equal split calculation (shown live in modal)
- [x] Edit expense (pre-filled modal, re-creates shares)
- [x] Delete expense (shares → expense → message cascade)
- [x] Edit/Delete only shown to creator (⋯ menu on bubble)
- [x] 6 categories: Food & Drink, Transport, Shopping, Entertainment, Bills, Other

### Balances (per group)
- [x] Net balance calculation (minimum cash flow algorithm)
- [x] Real-time sync via Supabase subscriptions (settlements + expense_shares)
- [x] Refetch on visibility change
- [x] Mark Paid → creates pending settlement
- [x] Confirm Received → updates existing pending to completed
- [x] Pending confirmation notice shown inline
- [x] "Pay Now" button on ExpenseBubble → navigates to balances page
- [x] **Debt Breakdown** — expandable per-expense list explaining why a debt exists
  - Shows which expenses created the debt (owed direction 🔴)
  - Shows which expenses reduce it (offset direction 🟢)
  - Category emoji, date, total amount, share amount
  - Net summary at bottom

### Settlements / Balances Page
- [x] Per-member balance chip
- [x] Debt cards (DebtCard + PendingDebtCard)
- [x] Remind debtor push notification (rate-limited: 2 per 48h, localStorage)
- [x] "All settled up" empty state
- [x] Stays on balances page after settling (no redirect)

### Global Balances (`/balances`)
- [x] Net balance across all groups — **batch-optimized** (4 queries total, no N+1)
- [x] Per-group summary card sorted by imbalance size

### Receipt OCR
- [x] Upload receipt photo
- [x] OCR extraction (merchant, date, items, total)
- [x] Review page: assign items to members, exclude items
- [x] Create expense from reviewed receipt

### Recurring Payments
- [x] Create recurring payment (daily/weekly/fortnightly/monthly/quarterly/yearly)
- [x] Next due date calculation + display
- [x] Delete recurring payment
- [x] Bell icon to send reminder push notification

### Push Notifications
- [x] Subscribe/unsubscribe in group settings
- [x] Push on: new message, @mention, expense added, settlement submitted/confirmed, debt reminder

### Statistics
- [x] Personal expense stats by category (week/month/year filter)
- [x] Breakdown with icons per category

---

## 5. ⚠️ Known Issues (Remaining)

### 🔴 Critical

| # | Issue | Location | Detail |
|---|---|---|---|
| 1 | **`010` migration not auto-applied** | Supabase | Delete group returns RLS error until SQL is run manually |
| 2 | **Leave group debt check uses wrong column** | `settings/page.tsx:77` | Uses `from_user_id` / `to_user_id` but schema has `from_user` / `to_user` → debt guard never blocks |
| 3 | **`settledPairs` not updated on new settlements** | `useGroupChat.ts` | Fetched once at init; "Pay Now" won't auto-hide until page reload |

### 🟠 Logic Issues

| # | Issue | Location | Detail |
|---|---|---|---|
| 4 | **Reverse-direction pending settlement** | `useSettlement.ts` | Confirming A→B while B→A expense added can worsen balance |
| 5 | **Delete expense with existing settlements** | `useExpense.ts` | Settlements referencing deleted expense debt remain in DB |
| 6 | **Remind debtor rate limit in localStorage** | `useRemindDebtor.ts` | Bypassable by clearing storage; not cross-device |
| 7 | **Recurring payments — no auto-trigger** | `recurring/page.tsx` | UI only; no cron/Edge Function to auto-create expenses |
| 8 | **Receipt OCR: no fallback for no-item receipts** | `receipt/[receiptId]` | Empty item list with no manual split fallback |

### 🟡 UX Issues

| # | Issue | Location | Detail |
|---|---|---|---|
| 9 | **Sign up shows "Failed" toast but succeeds** | `register/page.tsx` | Needs "Check your email" state instead of error |
| 10 | **No confirmation when deleting expense** | `ExpenseBubble.tsx` | Delete runs immediately — easy accidental tap |
| 11 | **No empty state for Members list when all $0** | `balances/page.tsx` | Confusing blank section |
| 12 | **ExpenseModal doesn't restore involvedMembers on edit** | `useExpense.ts` | Falls back to all members for old expenses without `involvedMembers` in metadata |
| 13 | **Mention dropdown z-index on mobile** | `groups/[groupId]/page.tsx` | May appear behind keyboard on iOS |
| 14 | **Image bubbles have no lightbox** | `MessageBubble.tsx` | Tapping image doesn't open fullscreen |
| 15 | **Statistics page is global, not per-group** | `statistics/page.tsx` | No group filter |

---

## 6. Technical Debt

| Item | Priority |
|---|---|
| `settings/page.tsx` — 500 lines, not yet refactored into hooks/components | Medium |
| `recurring/page.tsx` — 360 lines, no hook extraction | Low |
| `receipt/[receiptId]/page.tsx` — 390 lines, no extraction | Medium |
| No error boundary — uncaught error crashes entire page | Medium |
| `pushGroupNotify` called from hooks directly (should be Server Action) | Low |
| Remind rate-limit is localStorage-only (not cross-device) | Low |

---

## 7. Recommended Next Steps

### Priority 1 — Bug fixes
1. Fix `from_user_id` → `from_user` in `settings/page.tsx:77` (leave group debt guard)
2. Subscribe to `settlements` in `useGroupChat` to update `settledPairs` live
3. Apply `010` migration in Supabase Dashboard

### Priority 2 — UX polish
4. Add confirm dialog on expense delete (`ExpenseBubble`)
5. Fix sign up "Check your email" flow instead of error toast
6. Add image lightbox to `MessageBubble`

### Priority 3 — Features
7. Recurring payment Edge Function / cron auto-trigger
8. Per-group statistics filter
9. Receipt OCR fallback for no-item receipts (manual amount input)
10. Settlement note field ("Paid via Momo", "Cash", etc.)

### Priority 4 — Hardening
11. DB-backed reminder rate limiting
12. Error boundaries per page
13. Split preview in expense modal (show net per person before saving)
