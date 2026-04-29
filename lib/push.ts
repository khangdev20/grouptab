// Helper to trigger push notifications from server-side API routes
export async function sendPush(payload: {
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: 'expense' | 'mention' | 'settlement' | 'reminder'
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    await fetch(`${base}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.PUSH_SECRET!,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Push is best-effort, never block main flow
  }
}
