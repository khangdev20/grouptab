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

  return memberIds.map((id) => ({
    userId: id,
    amount: Math.round((balanceMap.get(id) ?? 0) * 100) / 100,
  }))
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
