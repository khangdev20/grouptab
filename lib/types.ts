export type Profile = {
  id: string
  name: string
  email?: string
  avatar_url: string | null
  created_at: string
}

export type Group = {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  theme_color?: string
  created_by: string | null
  invite_code: string
  created_at: string
  member_count?: number
  my_role?: 'admin' | 'member'
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profile?: Profile
}

export type MessageType = 'text' | 'expense' | 'settlement' | 'receipt_pending' | 'image'

export type Message = {
  id: string
  group_id: string
  sender_id: string
  type: MessageType
  content: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type Receipt = {
  id: string
  group_id: string
  uploaded_by: string | null
  image_url: string | null
  merchant_name: string | null
  receipt_date: string | null
  total_amount: number | null
  ocr_data: { items: OCRItem[]; merchant_name?: string; date?: string; total?: number } | null
  status: 'pending' | 'confirmed'
  created_at: string
}

export type ReceiptItem = {
  id: string
  receipt_id: string
  name: string
  price: number
  quantity: number
  total_price: number
}

export type ReceiptItemAssignment = {
  id: string
  receipt_item_id: string
  user_id: string
  amount: number
}

export type Expense = {
  id: string
  group_id: string
  receipt_id: string | null
  paid_by: string | null
  description: string
  total_amount: number
  split_type: string
  category?: string
  created_at: string
}

export type ExpenseShare = {
  id: string
  expense_id: string
  user_id: string
  amount: number
  // joined from expenses
  expenses?: {
    group_id: string
    paid_by: string
    total_amount: number
  }
}

export type Settlement = {
  id: string
  group_id: string
  from_user_id: string
  to_user_id: string
  amount: number
  status: string
  created_at: string
}

// Balance types
export type Balance = {
  userId: string
  amount: number // positive = owed to user, negative = user owes
}

export type Debt = {
  from: string   // user id
  to: string     // user id
  amount: number
}

// OCR types
export type OCRItem = {
  name: string
  price: number
  quantity: number
}

export type OCRResult = {
  merchant_name: string | null
  date: string | null
  items: OCRItem[]
  total: number | null
  raw_text?: string
}

export type RecurringFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'

export type RecurringPayment = {
  id: string
  group_id: string
  created_by: string | null
  title: string
  amount: number
  frequency: RecurringFrequency
  frequency_config: {
    days_of_week?: number[]      // 0=Sun..6=Sat, for weekly/fortnightly
    day_of_month?: number        // 1-31, for monthly/quarterly/yearly
    month?: number               // 1-12, for quarterly/yearly
  }
  next_due_date: string | null
  payer_id: string | null
  involved_members: string[]
  notes: string | null
  active: boolean
  created_at: string
}
