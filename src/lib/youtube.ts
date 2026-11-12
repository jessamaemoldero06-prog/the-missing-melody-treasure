import { useEffect, useRef, useState } from 'react'

/* Minimal typings for the YouTube IFrame Player API. */
export type YTPlayer = {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume(v: number): void
  destroy(): void
}

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      host?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(timeoutMs = 20000): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      apiPromise = null
      reject(new Error('The YouTube player took too long to load.'))
    }, timeoutMs)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      window.clearTimeout(timer)
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      apiPromise = null
      script.remove()
      reject(new Error('Could not reach YouTube. Check the internet connection.'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

export function describeYouTubeError(code: number) {
  switch (code) {
    case 2:
      return 'The video link is invalid. Ask the host to check the YouTube link.'
    case 5:
      return 'This browser could not play the video. Try another browser.'
    case 100:
      return 'This video was removed or made private on YouTube.'
    case 101:
    case 150:
    case 153:
      return 'The video owner does not allow this video to play inside other websites.'
    default:
      return `YouTube reported an error (code ${code}).`
  }
}

type Options = {
  videoId: string
  onStateChange?: (state: number, player: YTPlayer) => void
  controls?: boolean
}

/**
 * Mounts a YouTube player into the returned ref and exposes it once ready.
 * Re-creates the player when `videoId` or `attempt` changes.
 */
export function useYouTubePlayer({ videoId, onStateChange, controls = false }: Options) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const stateCb = useRef(onStateChange)
  useEffect(() => {
    stateCb.current = onStateChange
  })

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    const host = hostRef.current
    if (!host) return
    const mount = document.createElement('div')
    host.innerHTML = ''
    host.appendChild(mount)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        playerRef.current = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            controls: controls ? 1 : 0,
            disablekb: controls ? 0 : 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true)
            },
            onStateChange: (e) => stateCb.current?.(e.data, e.target),
            onError: (e) => {
              if (!cancelled) setError(describeYouTubeError(e.data))
            },
          },
        })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* player already gone */
      }
      playerRef.current = null
      host.innerHTML = ''
    }
  }, [videoId, attempt, controls])

  return {
    hostRef,
    playerRef,
    ready,
    error,
    retry: () => setAttempt((a) => a + 1),
  }
}
