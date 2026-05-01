import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Balance, Debt, ExpenseShare, Settlement } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return date.toLocaleDateString('en-AU', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateAvatarColor(id: string) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Calculate net balances for a group from expense shares and settlements.
 * shares must include the joined expenses data (paid_by, total_amount).
 * memberIds: all user IDs in the group.
 */
export function calculateBalances(
  shares: ExpenseShare[],
  settlements: Settlement[],
  memberIds: string[]
): Balance[] {
  const balanceMap = new Map<string, number>()

  // Init all members to 0
  memberIds.forEach((id) => balanceMap.set(id, 0))

  // Process expense shares
  // For each expense: the payer is owed the total; each sharer owes their share amount
  const expenseMap = new Map<string, { paid_by: string; total: number; sharers: { uid: string; amount: number }[] }>()

  for (const share of shares) {
    const exp = share.expenses
    if (!exp) continue
    const expId = share.expense_id
    if (!expenseMap.has(expId)) {
      expenseMap.set(expId, { paid_by: exp.paid_by, total: exp.total_amount, sharers: [] })
    }
    expenseMap.get(expId)!.sharers.push({ uid: share.user_id, amount: share.amount })
  }

  for (const [, exp] of expenseMap) {
    const payer = exp.paid_by
    // Payer is credited for total paid
    const payerCurrent = balanceMap.get(payer) ?? 0
    balanceMap.set(payer, payerCurrent + exp.total)
    // Each sharer is debited for their share
    for (const sharer of exp.sharers) {
      const current = balanceMap.get(sharer.uid) ?? 0
      balanceMap.set(sharer.uid, current - sharer.amount)
    }
  }

  // Settlements adjust balances
  for (const s of settlements) {
    const fromCurrent = balanceMap.get(s.from_user) ?? 0
    const toCurrent = balanceMap.get(s.to_user) ?? 0
    balanceMap.set(s.from_user, fromCurrent + s.amount)
    balanceMap.set(s.to_user, toCurrent - s.amount)
  }

  const result: Balance[] = []
  for (const [userId, amount] of balanceMap.entries()) {
    result.push({
      userId,
      amount: Math.round(amount * 100) / 100,
    })
  }
  return result
}

/**
 * Simplify debts using the minimum cash flow algorithm.
 * Returns who pays whom and how much.
 */
export function simplifyDebts(balances: Balance[]): Debt[] {
  const creditors = balances
    .filter((b) => b.amount > 0.01)
    .map((b) => ({ userId: b.userId, amount: b.amount }))
    .sort((a, b) => b.amount - a.amount)

  const debtors = balances
    .filter((b) => b.amount < -0.01)
    .map((b) => ({ userId: b.userId, amount: Math.abs(b.amount) }))
    .sort((a, b) => b.amount - a.amount)

  const debts: Debt[] = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const settle = Math.min(debtors[i].amount, creditors[j].amount)
    if (settle > 0.01) {
      debts.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: Math.round(settle * 100) / 100,
      })
    }
    debtors[i].amount -= settle
    creditors[j].amount -= settle
    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }

  return debts
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
  })
}

// ── Debt Breakdown ────────────────────────────────────────────────────────────

export interface DebtBreakdownItem {
  expenseId: string
  description: string
  date: string          // ISO string
  category: string
  totalAmount: number
  shareAmount: number   // absolute value — how much this expense contributes to the debt
  /** 'owed' = creditor paid, debtor owes this amount to creditor
   *  'offset' = debtor paid, creditor owes debtor (reduces the net debt) */
  direction: 'owed' | 'offset'
  paidBy: string        // user id of payer
}

/**
 * Given a list of enriched expense shares (with joined `expenses` data including
 * description, created_at, category), return the individual expense breakdown
 * that explains why `debtorId` owes `creditorId` money.
 *
 * Works on raw/unsimplified debts — shows all direct expense relationships
 * between the two people regardless of the simplification algorithm.
 */
export function getDebtBreakdown(
  debtorId: string,
  creditorId: string,
  shares: Array<{
    user_id: string
    amount: number
    expense_id: string
    expenses: {
      id: string
      group_id: string
      paid_by: string
      total_amount: number
      description: string
      created_at: string
      category: string
    }
  }>,
): DebtBreakdownItem[] {
  // Group shares by expense_id
  const expenseMap = new Map<string, {
    exp: typeof shares[number]['expenses']
    sharerIds: Set<string>
    shareAmounts: Map<string, number>
  }>()

  for (const s of shares) {
    const exp = s.expenses
    if (!exp) continue
    if (!expenseMap.has(s.expense_id)) {
      expenseMap.set(s.expense_id, { exp, sharerIds: new Set(), shareAmounts: new Map() })
    }
    const entry = expenseMap.get(s.expense_id)!
    entry.sharerIds.add(s.user_id)
    entry.shareAmounts.set(s.user_id, s.amount)
  }

  const items: DebtBreakdownItem[] = []

  for (const [expId, { exp, sharerIds, shareAmounts }] of expenseMap) {
    const paidBy = exp.paid_by

    // Creditor paid → debtor has a share → debtor owes creditor
    if (paidBy === creditorId && sharerIds.has(debtorId)) {
      const shareAmt = shareAmounts.get(debtorId) ?? 0
      if (shareAmt > 0.005) {
        items.push({
          expenseId: expId,
          description: exp.description,
          date: exp.created_at,
          category: exp.category ?? 'other',
          totalAmount: exp.total_amount,
          shareAmount: shareAmt,
          direction: 'owed',
          paidBy,
        })
      }
    }

    // Debtor paid → creditor has a share → this reduces debtor's net debt
    if (paidBy === debtorId && sharerIds.has(creditorId)) {
      const shareAmt = shareAmounts.get(creditorId) ?? 0
      if (shareAmt > 0.005) {
        items.push({
          expenseId: expId,
          description: exp.description,
          date: exp.created_at,
          category: exp.category ?? 'other',
          totalAmount: exp.total_amount,
          shareAmount: shareAmt,
          direction: 'offset',
          paidBy,
        })
      }
    }
  }

  // Sort chronologically
  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Send a push notification to all group members (best-effort).
 */
export async function pushGroupNotify(
  groupId: string,
  title: string,
  body: string,
  tag?: string,
) {
  try {
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, title, body, url: `/groups/${groupId}`, tag }),
    })
  } catch { /* best-effort */ }
}

export type RemindEntry = { count: number; windowStart: number }
export type RemindMap = Record<string, RemindEntry>

/**
 * Rate-limit helper for remind-debtor flow.
 * Returns { canRemind, remaining } based on localStorage-persisted remindMap.
 */
export function getRateLimitState(
  map: RemindMap,
  key: string,
  limit: number,
  windowMs: number,
): { canRemind: boolean; remaining: number; count: number } {
  const entry = map[key]
  if (!entry) return { count: 0, canRemind: true, remaining: limit }
  const elapsed = Date.now() - entry.windowStart
  if (elapsed >= windowMs) return { count: 0, canRemind: true, remaining: limit }
  return {
    count: entry.count,
    canRemind: entry.count < limit,
    remaining: limit - entry.count,
  }
}

/**
 * Increment the rate-limit counter in a RemindMap, resetting window if needed.
 */
export function incrementRateLimit(
  map: RemindMap,
  key: string,
  windowMs: number,
): RemindMap {
  const entry = map[key]
  const now = Date.now()
  if (!entry || now - entry.windowStart >= windowMs) {
    return { ...map, [key]: { count: 1, windowStart: now } }
  }
  return { ...map, [key]: { count: entry.count + 1, windowStart: entry.windowStart } }
}
