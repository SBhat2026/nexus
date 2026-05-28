import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function decomposeQuery(seedTopic: string): Promise<string[]> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: `You are an academic search specialist. Given a research topic, return a JSON array of exactly 4 search queries that together maximize coverage of the topic in academic literature. Rules:
- Each query must be 3-6 words
- Query 1: the core mechanism or method
- Query 2: the primary application domain
- Query 3: a key synonym or related framework
- Query 4: an adjacent subfield that would appear in the same literature
- Return ONLY a valid JSON array of 4 strings. No explanation, no markdown.`,
        },
        {
          role: 'user',
          content: `Research topic: "${seedTopic}"`,
        },
      ],
    })

    const raw = completion.choices[0].message.content?.trim() ?? '[]'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((q) => typeof q === 'string')) {
      return parsed
    }
  } catch (err) {
    console.warn('[decompose] Groq decomposition failed, falling back to seed:', err)
  }
  return [seedTopic]
}
