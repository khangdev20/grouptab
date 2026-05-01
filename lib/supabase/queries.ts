import { SupabaseClient } from '@supabase/supabase-js'

// ── Members ──────────────────────────────────────────────────────────────────
export async function fetchGroupMembers(supabase: SupabaseClient, groupId: string) {
  return supabase
    .from('group_members')
    .select('user_id, profiles(*)')
    .eq('group_id', groupId)
}

// ── Messages ─────────────────────────────────────────────────────────────────
export async function fetchMessages(
  supabase: SupabaseClient,
  groupId: string,
  limit = 30,
  before?: string,
) {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) q = q.lt('created_at', before)
  return q
}

export async function fetchMessagesSince(
  supabase: SupabaseClient,
  groupId: string,
  after: string,
) {
  return supabase
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .gt('created_at', after)
    .order('created_at', { ascending: true })
}

export async function insertMessage(supabase: SupabaseClient, payload: {
  group_id: string
  sender_id: string
  type: string
  content: string | null
  metadata?: Record<string, unknown>
}) {
  return supabase.from('messages').insert(payload)
}

// ── Expense Shares ────────────────────────────────────────────────────────────
export async function fetchExpenseShares(supabase: SupabaseClient, groupId: string) {
  return supabase
    .from('expense_shares')
    .select('*, expenses!inner(group_id, paid_by, total_amount)')
    .eq('expenses.group_id', groupId)
}

// ── Settlements ───────────────────────────────────────────────────────────────
export async function fetchSettlements(supabase: SupabaseClient, groupId: string) {
  return supabase
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
}

export async function fetchCompletedSettlementPairs(supabase: SupabaseClient, groupId: string) {
  return supabase
    .from('settlements')
    .select('from_user, to_user')
    .eq('group_id', groupId)
    .eq('status', 'completed')
}
