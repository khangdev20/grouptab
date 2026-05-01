# GroupTab — Project Documentation
> Updated: 2026-05-01

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
│   │   ├── balances/         # Per-group settle up
│   │   ├── receipt/[id]/     # OCR receipt review + split
│   │   ├── recurring/        # Recurring payment schedules
│   │   └── settings/         # Group settings + leave/delete
│   ├── balances/             # Global balances across all groups
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
├── useRemindDebtor.ts        # Rate-limited debt reminders
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
│   ├── DebtCard.tsx          # Debt row (Mark Paid / Confirm Received)
│   └── PendingDebtCard.tsx   # Amber pending-only card
├── receipt/
│   └── ItemCard.tsx          # Receipt item assignment
└── ui/
    ├── Avatar.tsx            # User avatar with initials fallback
    └── Logo.tsx              # App logo

lib/
├── types.ts                  # All TypeScript types
├── utils.ts                  # formatCurrency, calculateBalances, simplifyDebts,
│                             # pushGroupNotify, getRateLimitState, etc.
└── supabase/
    ├── client.ts             # Supabase client singleton
    └── queries.ts            # Reusable DB query functions
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

**RLS**: All tables have Row Level Security. Key policies:
- Groups: members can SELECT, admins can UPDATE/DELETE
- Messages: members can INSERT/SELECT, UPDATE own messages
- Expenses/Shares: members can INSERT/SELECT
- Settlements: members can INSERT/SELECT/UPDATE
- `010_group_delete_policy.sql` — admin DELETE policy (must apply to Supabase manually)

---

## 4. ✅ Features Completed

### Authentication
- [x] Email/password sign up + sign in
- [x] Google OAuth
- [x] Auth callback handling

### Groups
- [x] Create group (name, description, avatar)
- [x] Group list with member count + last activity
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
- [x] Confirm Received → updates existing pending to completed (not insert)
- [x] Pending confirmation notice shown inline when mixed state
- [x] "Pay Now" button on ExpenseBubble → navigates to balances page
- [x] Pay Now hidden if debt already settled (checks settledPairs)

### Settlements / Balances Page
- [x] Per-member balance chip
- [x] Debt cards (DebtCard + PendingDebtCard)
- [x] Remind debtor push notification (rate-limited: 2 per 48h, localStorage)
- [x] "All settled up" empty state

### Global Balances
- [x] `/balances` page: net balance across all groups
- [x] Per-group summary card with link to group balances

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
- [x] Push on new message, @mention, expense added, settlement submitted/confirmed, debt reminder

### Statistics
- [x] Personal expense stats by category (week/month/year filter)
- [x] Breakdown with icons per category

---

## 5. ⚠️ Known UX/Logic Issues

### 🔴 Critical

| # | Issue | Location | Detail |
|---|---|---|---|
| 1 | **`010` migration not auto-applied** | Supabase | `Delete group` returns error for admin until SQL is manually run in Supabase Dashboard |
| 2 | **Leave group debt check uses wrong column** | `settings/page.tsx:77` | Checks `s.from_user_id` / `s.to_user_id` but schema uses `from_user` / `to_user` → debt check always passes (never blocks leave) |
| 3 | **`settledPairs` not updated on new settlements** | `useGroupChat.ts` | `settledPairs` is fetched once on init. If a settlement is confirmed while the user is in the chat, "Pay Now" button won't hide without a page reload |

### 🟠 Logic Issues

| # | Issue | Location | Detail |
|---|---|---|---|
| 4 | **Reverse-direction pending settlement** | `useSettlement.ts` | If A marks $6 paid to B (pending), then a new expense reverses the direction (B now owes A), confirming the old A→B settlement will make balances WORSE (add to debt instead of reducing). No warning shown in chat. |
| 5 | **Delete expense with existing settlements** | `useExpense.ts:handleDelete` | Deleting an expense only removes `expense_shares` + `expenses` + `message`. If settlements referencing that expense's debt exist, they remain in DB and distort balance. |
| 6 | **Remind debtor rate limit in localStorage** | `useRemindDebtor.ts` | Easily bypassed (clear storage). Different devices have independent limits. Should be DB-backed. |
| 7 | **Recurring payments — no auto-trigger** | `recurring/page.tsx` | Recurring payments are UI-only. `next_due_date` is stored but nothing auto-creates expenses when due. Requires a cron job / Supabase Edge Function. |
| 8 | **Receipt OCR fallback for non-itemized receipts** | `receipt/[receiptId]/page.tsx` | If OCR returns no items (only total), the review page shows an empty item list with no fallback to manual split. User is stuck. |

### 🟡 UX Issues

| # | Issue | Location | Detail |
|---|---|---|---|
| 9 | **Sign up shows "Failed" toast but succeeds** | `register/page.tsx` | Email confirmation flow causes error toast even when registration succeeds. Needs "Check your email" state instead of error. |
| 10 | **Balance page navigates away after settle** | `useSettlement.ts:onDone` | After Mark Paid or Confirm, user is sent back to chat. Many users would prefer to stay on balances page to settle other debts. |
| 11 | **No empty state for balances member list** | `balances/page.tsx` | If all balances are exactly $0 (including self), the Members section shows nothing — confusing. |
| 12 | **ExpenseModal doesn't restore involvedMembers on edit** | `useExpense.ts:openEdit` | The edit form falls back to `Object.keys(profiles)` if `meta.involvedMembers` is undefined (old expenses before the field was added). |
| 13 | **No confirmation when deleting expense from chat** | `ExpenseBubble.tsx` | Delete runs immediately without a confirmation step — easy to accidentally tap. |
| 14 | **Mention dropdown z-index on mobile** | `groups/[groupId]/page.tsx` | On small screens the @mention dropdown may appear behind the keyboard on iOS. |
| 15 | **Image bubbles have no lightbox** | `MessageBubble.tsx` | Tapping an image in chat doesn't open a fullscreen view. |
| 16 | **Statistics page is global, not per-group** | `statistics/page.tsx` | Stats mix expenses from all groups. No way to filter by group. |
| 17 | **Group list not sorted by latest activity** | `groups/page.tsx` | Groups are ordered by `joined_at` (when you joined), not by most recent message/expense. |
| 18 | **No loading skeleton in balances page** | `balances/page.tsx` | Loading state shows only 3 placeholder blocks regardless of actual debt count. |

---

## 6. Technical Debt

| Item | Priority |
|---|---|
| `settings/page.tsx` still 500 lines — not yet refactored | Medium |
| `recurring/page.tsx` 360 lines — no hook extraction | Low |
| `receipt/[receiptId]/page.tsx` 390 lines — no extraction | Medium |
| `app/(app)/balances/page.tsx` N+1 query per group (loop inside init) | High |
| `pushGroupNotify` called from hooks directly — should use Server Action | Low |
| No error boundary — any uncaught error crashes the whole page | Medium |

---

## 7. Recommended Next Steps

### Priority 1 — Bug fixes
1. **Fix leave-group debt check** — change `from_user_id` → `from_user` in `settings/page.tsx:77`
2. **Fix settledPairs realtime** — subscribe to `settlements` in `useGroupChat` to update `settledPairs` live
3. **Apply `010` migration** — run in Supabase Dashboard SQL editor

### Priority 2 — UX polish
4. **Add confirmation dialog on expense delete** — reuse the pattern from settings leave/delete
5. **Stay on balances page after settle** — remove `onDone: () => router.push(...)` or make it optional
6. **Fix sign up error toast** — show "Check your email" for unconfirmed accounts

### Priority 3 — Features
7. **Image lightbox** — tap to fullscreen in MessageBubble
8. **Recurring payment cron** — Supabase Edge Function scheduled to create expenses on `next_due_date`
9. **Per-group statistics** — filter stats by groupId
10. **Receipt fallback** — if no OCR items, allow manual total split in review page

### Priority 4 — Hardening
11. **DB-backed rate limiting for reminders** — store remind counts in `settlements` metadata or separate table
12. **N+1 fix in global balances page** — batch fetch all groups' shares and settlements in one query
13. **Error boundaries** — wrap each page in `<ErrorBoundary>`
