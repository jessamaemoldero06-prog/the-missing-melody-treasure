import { createFileRoute } from '@tanstack/react-router'

import { checkHostPin } from '@/server/host-auth'

export const Route = createFileRoute('/api/host-check')({
  server: {
    handlers: {
      POST: ({ request }) => checkHostPin(request) ?? Response.json({ ok: true }),
    },
  },
})
