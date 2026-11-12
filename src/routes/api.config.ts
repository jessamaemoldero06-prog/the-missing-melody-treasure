import { createFileRoute } from '@tanstack/react-router'
import { getStore } from '@netlify/blobs'

import { gameConfigSchema } from '@/lib/game-config'
import { checkHostPin } from '@/server/host-auth'

const STORE = 'finish-the-lyrics'
const KEY = 'game-config'

const store = () => getStore({ name: STORE, consistency: 'strong' })

export const Route = createFileRoute('/api/config')({
  server: {
    handlers: {
      // Public: the game reads the host-saved lyrics/timestamps (or null for defaults).
      GET: async () => {
        try {
          const saved = await store().get(KEY, { type: 'json' })
          const parsed = saved ? gameConfigSchema.safeParse(saved) : null
          return Response.json(
            { config: parsed?.success ? parsed.data : null },
            { headers: { 'cache-control': 'no-store' } },
          )
        } catch {
          return Response.json({ config: null, error: 'Storage unavailable' })
        }
      },
      // Host only: save edited lyrics/timestamps.
      PUT: async ({ request }) => {
        const denied = checkHostPin(request)
        if (denied) return denied
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }
        const parsed = gameConfigSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: 'The song data is not valid.', issues: parsed.error.issues.slice(0, 5) },
            { status: 400 },
          )
        }
        await store().setJSON(KEY, parsed.data)
        return Response.json({ ok: true })
      },
      // Host only: go back to the built-in defaults.
      DELETE: async ({ request }) => {
        const denied = checkHostPin(request)
        if (denied) return denied
        await store().delete(KEY)
        return Response.json({ ok: true })
      },
    },
  },
})
