import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (!['pdf', 'md', 'txt'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Unsupported file type. Use .pdf, .md, or .txt' }, { status: 415 })
  }

  try {
    if (ext === 'pdf') {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await pdfParse(buffer)
      const text = parsed.text.trim()
      if (!text) return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })
      return NextResponse.json({ text })
    }

    // .md and .txt — read as UTF-8 text directly
    const text = (await file.text()).trim()
    if (!text) return NextResponse.json({ error: 'File is empty' }, { status: 422 })
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}
