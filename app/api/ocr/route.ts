import { NextRequest, NextResponse } from 'next/server'
import { extractReceiptData } from '@/lib/gemini'
import { fileToBase64 } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const result = await extractReceiptData(base64, mimeType)

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('OCR error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
