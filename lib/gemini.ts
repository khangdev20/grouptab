import { GoogleGenerativeAI } from '@google/generative-ai'
import type { OCRResult } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const RECEIPT_PROMPT = `You are an expert receipt parser. Analyze this receipt image and extract all information in JSON format.

Return ONLY valid JSON with this exact structure:
{
  "merchant_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "item name",
      "price": 0.00,
      "quantity": 1
    }
  ],
  "total": 0.00 or null
}

Rules:
- Include ALL line items you can see (food, drinks, services, etc.)
- Do NOT include tax, service charge, or tip as individual items (add them to total only)
- Price should be the total price for that line (quantity * unit price)
- If quantity is not shown, assume 1
- Return numbers as floats, not strings
- If you cannot read something clearly, make your best guess
- Return ONLY the JSON, no other text`

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg'): Promise<OCRResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    },
    RECEIPT_PROMPT,
  ])

  const text = result.response.text().trim()

  // Strip markdown code blocks if present
  const jsonText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(jsonText) as OCRResult
    return parsed
  } catch {
    // Return fallback if parsing fails
    return {
      merchant_name: null,
      date: null,
      items: [],
      total: null,
      raw_text: text,
    }
  }
}
