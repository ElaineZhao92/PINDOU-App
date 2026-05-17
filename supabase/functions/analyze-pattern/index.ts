import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Check openrouter.ai/models for the latest Gemini Flash model ID
const MODEL = 'google/gemini-3-flash'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // 1. Verify user JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // 2. Read user's OpenRouter API key from user_settings
    const { data: settingsRow, error: settingsErr } = await supabase
      .from('user_settings')
      .select('openrouter_api_key')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsErr) return json({ error: 'Failed to read settings' }, 500)

    const openrouterKey = settingsRow?.openrouter_api_key
    if (!openrouterKey) {
      return json({
        error: '未设置 OpenRouter API Key，请先在「设置」页面中添加你的 API Key。',
        code: 'NO_API_KEY',
      }, 400)
    }

    // 3. Parse request body
    const { imageUrls } = await req.json() as { imageUrls: string[] }
    if (!imageUrls || imageUrls.length === 0) {
      return json({ error: 'Missing imageUrls' }, 400)
    }

    // 4. Build message content with all images + instruction
    // Gemini supports multiple images in one message
    const imageContent = imageUrls.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))

    const prompt = imageUrls.length === 1
      ? '请分析这张拼豆图纸，列出所有需要的颜色色号和每种颜色的数量。'
      : `请分析这 ${imageUrls.length} 张拼豆图纸，统计所有图纸合计需要的颜色色号和数量（相同色号的数量相加）。`

    const messages = [
      {
        role: 'system',
        content: `你是拼豆图纸分析助手。分析图纸中每种颜色对应的拼豆色号和数量。
色号格式：字母+数字，有效系列为 A(1-26)、B(1-32)、C(1-29)、D(1-26)、E(1-24)、F(1-25)、G(1-21)、H(1-23)、M(1-15)。
只返回 JSON 数组，不要包含任何其他文字、注释或 Markdown 代码块。
格式：[{"color_code":"A1","quantity":120},{"color_code":"B3","quantity":45}]`,
      },
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      },
    ]

    // 5. Call OpenRouter
    const aiRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': supabaseUrl,
        'X-Title': 'PINDOU App',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 4000,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenRouter error:', errText)
      // Surface meaningful errors to the user
      if (aiRes.status === 401) return json({ error: 'API Key 无效，请在设置中检查你的 OpenRouter Key。' }, 400)
      if (aiRes.status === 402) return json({ error: 'OpenRouter 账户余额不足，请前往 openrouter.ai 充值。' }, 400)
      if (aiRes.status === 429) return json({ error: '请求过于频繁，请稍后再试。' }, 429)
      return json({ error: `AI 服务错误 (${aiRes.status})：${errText.slice(0, 200)}` }, 502)
    }

    const aiData = await aiRes.json()
    const content: string = aiData.choices?.[0]?.message?.content ?? ''

    // 6. Parse JSON from response (handle potential markdown fences)
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array in response:', content)
      return json({ error: `AI 返回了无法解析的内容：${content.slice(0, 300)}` }, 500)
    }

    let parsed: { color_code: string; quantity: number }[]
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      return json({ error: '解析 AI 返回数据失败，请重试。' }, 500)
    }

    // 7. Validate, deduplicate (sum same color codes), and sanitize
    const validCode = /^[A-HM]\d{1,2}$/
    const merged: Record<string, number> = {}
    for (const item of parsed) {
      if (!item.color_code || !validCode.test(item.color_code)) continue
      const qty = Math.round(Math.abs(item.quantity || 0))
      if (qty <= 0) continue
      merged[item.color_code] = (merged[item.color_code] ?? 0) + qty
    }

    const results = Object.entries(merged).map(([color_code, quantity]) => ({ color_code, quantity }))

    if (results.length === 0) {
      return json({ error: 'AI 未能识别出任何有效色号，请确认上传的是拼豆图纸。' }, 422)
    }

    return json(results)
  } catch (err) {
    console.error('Unhandled error:', err)
    return json({ error: '服务器内部错误，请重试。' }, 500)
  }
})
