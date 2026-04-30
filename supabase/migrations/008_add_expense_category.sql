-- Add category to expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

-- Update the type constraint for message type if we needed (we don't for category, but just in case)
-- no need

-- Update the view or RPCs if any (probably none depend on select * from expenses, but we'll see)
