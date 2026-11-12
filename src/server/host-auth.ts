import { timingSafeEqual } from 'node:crypto'

/** Checks the host PIN sent in the `x-host-pin` header against the HOST_PIN env var. */
export function checkHostPin(request: Request): Response | null {
  const expected = process.env.HOST_PIN
  if (!expected) {
    return Response.json(
      { error: 'Host PIN is not configured for this site yet.' },
      { status: 503 },
    )
  }
  const given = request.headers.get('x-host-pin') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: 'Incorrect host PIN.' }, { status: 401 })
  }
  return null
}
