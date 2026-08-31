export interface Env {
  RESEND_API_KEY: string
  POSTHOG_WEBHOOK_SECRET: string
  RESEND_FROM: string
}

const MAX_BODY_BYTES = 32 * 1024
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const RECIPIENT = 'internal@freifahren.org'

type FeedbackPayload = {
  message: string
  eventId?: string
  feedbackType?: string
  source?: string
  city?: string
  platform?: string
  submittedAt?: string
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  if (aBytes.byteLength !== bBytes.byteLength) return false
  return crypto.subtle.timingSafeEqual(aBytes, bBytes)
}

function stringProperty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

export function parseFeedback(body: unknown): FeedbackPayload | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const payload = body as Record<string, unknown>
  const properties =
    payload.properties !== null && typeof payload.properties === 'object' && !Array.isArray(payload.properties)
      ? (payload.properties as Record<string, unknown>)
      : payload
  const message = stringProperty(payload.message) ?? stringProperty(properties.$survey_response_1)
  if (message === undefined) return null

  return {
    message,
    eventId: stringProperty(payload.uuid) ?? stringProperty(payload.id) ?? stringProperty(properties.$event_id),
    feedbackType: stringProperty(payload.feedbackType) ?? stringProperty(properties.$survey_response),
    source: stringProperty(payload.source) ?? stringProperty(properties.feedback_source),
    city: stringProperty(payload.city) ?? stringProperty(properties.city),
    platform: stringProperty(payload.platform) ?? stringProperty(properties.platform),
    submittedAt:
      stringProperty(payload.submittedAt) ?? stringProperty(payload.timestamp) ?? stringProperty(properties.timestamp),
  }
}

function emailText(feedback: FeedbackPayload): string {
  const details = [
    ['Type', feedback.feedbackType],
    ['Source', feedback.source],
    ['City', feedback.city],
    ['Platform', feedback.platform],
    ['Submitted', feedback.submittedAt],
  ].filter(([, value]) => value !== undefined)

  return `${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${feedback.message}`.trim()
}

async function sendEmail(feedback: FeedbackPayload, env: Env): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  }
  // Resend keeps idempotency keys for 24 hours, which covers PostHog's delivery retries.
  if (feedback.eventId !== undefined) headers['Idempotency-Key'] = feedback.eventId

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [RECIPIENT],
      subject: `[Feedback${feedback.feedbackType ? ` · ${feedback.feedbackType}` : ''}]`,
      text: emailText(feedback),
    }),
  })
  return response
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') return new Response('ok')
    if (request.method !== 'POST' || url.pathname !== '/posthog/feedback') return new Response('not found', { status: 404 })

    if (!timingSafeEqual(request.headers.get('authorization') ?? '', `Bearer ${env.POSTHOG_WEBHOOK_SECRET}`)) {
      return new Response('unauthorized', { status: 401 })
    }
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
      return new Response('payload too large', { status: 413 })
    }

    let feedback: FeedbackPayload | null
    try {
      feedback = parseFeedback(await request.json())
    } catch {
      return new Response('invalid JSON', { status: 400 })
    }
    if (feedback === null) return new Response('missing feedback message', { status: 400 })

    try {
      const response = await sendEmail(feedback, env)
      if (!response.ok) {
        console.error(JSON.stringify({ event: 'feedback_email_failed', status: response.status }))
        return new Response('email delivery failed', { status: 502 })
      }
      console.log(JSON.stringify({ event: 'feedback_email_sent', feedbackType: feedback.feedbackType }))
      return new Response('accepted', { status: 202 })
    } catch (error) {
      console.error(JSON.stringify({ event: 'feedback_email_failed', error: String(error) }))
      return new Response('email delivery failed', { status: 502 })
    }
  },
} satisfies ExportedHandler<Env>
