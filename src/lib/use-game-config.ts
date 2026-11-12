import { useEffect, useState } from 'react'

import { defaultConfig } from '@/data/songs'
import { gameConfigSchema, type GameConfig } from '@/lib/game-config'

/** Loads the host-saved game data, falling back to the built-in defaults. */
export function useGameConfig() {
  const [config, setConfig] = useState<GameConfig>(defaultConfig)
  const [source, setSource] = useState<'loading' | 'saved' | 'default'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { config: null }))
      .then((body: { config: unknown }) => {
        if (cancelled) return
        const parsed = body.config ? gameConfigSchema.safeParse(body.config) : null
        if (parsed?.success) {
          setConfig(parsed.data)
          setSource('saved')
        } else setSource('default')
      })
      .catch(() => !cancelled && setSource('default'))
    return () => {
      cancelled = true
    }
  }, [])

  return { config, setConfig, source }
}
