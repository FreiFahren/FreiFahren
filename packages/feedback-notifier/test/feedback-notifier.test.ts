import { env } from 'cloudflare:test'
import { describe, expect, it, vi } from 'vitest'
import worker, { parseFeedback } from '../src/index'

function request(body: unknown, secret = 'test-webhook-secret'): Request {
  return new Request('https://worker.test/posthog/feedback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseFeedback', () => {
  it('uses the survey sent event properties emitted by the app', () => {
    expect(
      parseFeedback({
        properties: {
          $survey_response: 'Outage',
          $survey_response_1: 'Departures have not updated for an hour.',
          feedback_source: 'settings',
          city: 'berlin',
          platform: 'web',
        },
      }),
    ).toEqual({
      feedbackType: 'Outage',
      message: 'Departures have not updated for an hour.',
      source: 'settings',
      city: 'berlin',
      platform: 'web',
      submittedAt: undefined,
    })
  })
})

describe('feedback webhook', () => {
  it('rejects a request without the shared secret', async () => {
    const response = await worker.fetch(request({ message: 'Broken' }, 'wrong'), env)
    expect(response.status).toBe(401)
  })

  it('sends a readable email for a valid PostHog survey event', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const response = await worker.fetch(
      request({ properties: { $survey_response: 'Outage', $survey_response_1: 'Nothing works', city: 'berlin' } }),
      env,
    )

    expect(response.status).toBe(202)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, options] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(options?.body))).toMatchObject({
      to: ['internal@freifahren.org'],
      subject: '[Feedback · Outage]',
      text: expect.stringContaining('Nothing works'),
    })
  })

  it('returns an error so PostHog can retry when Resend rejects delivery', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    const response = await worker.fetch(request({ message: 'Broken' }), env)
    expect(response.status).toBe(502)
  })
})
