import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Stamp,
  Trash2,
  Upload,
} from 'lucide-react'

import { LyricsDisplay } from '@/components/game/LyricsDisplay'
import { defaultConfig } from '@/data/songs'
import { isCorrectAnswer } from '@/lib/answers'
import {
  QUESTIONS_PER_SONG,
  formatTime,
  gameConfigSchema,
  lineStart,
  parseVideoId,
  questionsFor,
  splitBlank,
  validateSong,
  type GameConfig,
  type LyricLine,
  type Question,
  type Song,
} from '@/lib/game-config'
import { useGameConfig } from '@/lib/use-game-config'
import { cn } from '@/lib/utils'
import { YTState, useYouTubePlayer } from '@/lib/youtube'

export const Route = createFileRoute('/host')({
  head: () => ({ meta: [{ title: 'Host Setup — Finish the Lyrics' }, { name: 'robots', content: 'noindex' }] }),
  component: HostPage,
})

const PIN_KEY = 'ftl-host-pin'
const PROGRESS_KEY = 'ftl-progress-v1'

function HostPage() {
  const [pin, setPin] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const saved = window.sessionStorage.getItem(PIN_KEY)
    if (saved) setPin(saved)
  }, [])

  return (
    <div className="relative min-h-dvh text-foreground">
      <div className="quest-bg" aria-hidden />
      <header className="mx-auto flex max-w-content items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <div>
          <p className="text-xs font-extrabold tracking-[0.25em] text-pink-300 uppercase">Finish the Lyrics</p>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Host Setup</h1>
        </div>
        <Link to="/" className="btn-ghost-quest text-sm">
          <ArrowLeft className="size-4" /> Back to the game
        </Link>
      </header>
      {pin || offline ? (
        <Editor
          pin={pin}
          onLock={() => {
            window.sessionStorage.removeItem(PIN_KEY)
            setPin(null)
            setOffline(false)
          }}
        />
      ) : (
        <PinGate
          onUnlock={(p) => {
            window.sessionStorage.setItem(PIN_KEY, p)
            setPin(p)
          }}
          onOffline={() => setOffline(true)}
        />
      )}
    </div>
  )
}

function PinGate({ onUnlock, onOffline }: { onUnlock: (pin: string) => void; onOffline: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/host-check', { method: 'POST', headers: { 'x-host-pin': value } })
      if (res.ok) return onUnlock(value)
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 503) setNotConfigured(true)
      setError(body.error ?? 'Could not verify the PIN.')
    } catch {
      setError('Network error — check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={submit} className="glass rounded-3xl p-7">
        <Lock className="size-8 text-pink-300" />
        <h2 className="mt-3 font-display text-xl font-extrabold text-white">Host access</h2>
        <p className="mt-1 text-sm text-violet-100/80">
          Enter the host PIN to edit lyrics, timestamps, and missing words. This page contains the answers —
          keep it away from Sir H!
        </p>
        <label htmlFor="pin" className="mt-5 block text-sm font-bold text-violet-100">
          Host PIN
        </label>
        <input
          id="pin"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 h-12 w-full rounded-xl border-2 border-violet-300/40 bg-[#0b0a2a]/70 px-4 text-lg text-white focus:border-pink-400 focus:outline-none"
          autoComplete="current-password"
        />
        {error && (
          <p className="mt-2 text-sm font-bold text-amber-200" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-quest mt-5 w-full" disabled={busy || !value}>
          {busy ? 'Checking…' : 'Unlock host tools'}
        </button>
        {notConfigured && (
          <button type="button" className="btn-ghost-quest mt-3 w-full text-sm" onClick={onOffline}>
            Continue without online saving
          </button>
        )}
      </form>
    </div>
  )
}

/* ───────────────────────── Editor ───────────────────────── */

function Editor({ pin, onLock }: { pin: string | null; onLock: () => void }) {
  const { config: loaded, source } = useGameConfig()
  const [draft, setDraft] = useState<GameConfig>(loaded)
  const [dirty, setDirty] = useState(false)
  const [songIdx, setSongIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // Take the fetched config once; afterwards the draft is the source of truth.
  const initialized = useRef(false)
  useEffect(() => {
    if (source === 'loading' || initialized.current) return
    initialized.current = true
    setDraft(loaded)
  }, [loaded, source])

  const song = draft.songs[songIdx]
  const update = useCallback((fn: (c: GameConfig) => GameConfig) => {
    setDraft((c) => fn(structuredClone(c)))
    setDirty(true)
  }, [])
  const updateSong = useCallback(
    (fn: (s: Song) => void) =>
      update((c) => {
        fn(c.songs[songIdx])
        return c
      }),
    [update, songIdx],
  )

  const allIssues = draft.songs.map(validateSong)
  const blocking = draft.songs.some((s) => questionsFor(s).length !== QUESTIONS_PER_SONG)

  const save = async () => {
    if (!pin) return toast.error('Online saving is not set up. Use Export instead.')
    const parsed = gameConfigSchema.safeParse(draft)
    if (!parsed.success) return toast.error('Some fields are invalid. Check every line has text and a time.')
    if (blocking) return toast.error(`Each song needs exactly ${QUESTIONS_PER_SONG} missing lyrics before saving.`)
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-host-pin': pin },
        body: JSON.stringify(parsed.data),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Save failed')
      setDirty(false)
      toast.success('Saved! The game now uses these lyrics and timestamps on every device.')
    } catch (e) {
      toast.error((e as Error).message)
      if ((e as Error).message.includes('PIN')) onLock()
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = async () => {
    if (!window.confirm('Replace all edits with the built-in lyrics and timestamps?')) return
    if (pin) {
      const res = await fetch('/api/config', { method: 'DELETE', headers: { 'x-host-pin': pin } })
      if (!res.ok) return toast.error('Could not reset the saved data.')
    }
    setDraft(structuredClone(defaultConfig))
    setDirty(false)
    toast.success('Back to the built-in defaults.')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'finish-the-lyrics-config.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File) => {
    try {
      const parsed = gameConfigSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) return toast.error('That file is not a valid Finish the Lyrics config.')
      setDraft(parsed.data)
      setDirty(true)
      toast.success('Imported. Review it, then press Save online.')
    } catch {
      toast.error('Could not read that file.')
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 pt-5 pb-16 sm:px-6">
      {/* Toolbar */}
      <div className="glass sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <span className="mr-auto text-sm font-bold text-violet-100">
          {source === 'loading'
            ? 'Loading…'
            : dirty
              ? '● Unsaved changes'
              : source === 'saved'
                ? 'Using your saved data'
                : 'Using built-in defaults'}
          {!pin && <span className="ml-2 text-amber-200">(offline — saving disabled)</span>}
        </span>
        <button type="button" className="btn-quest px-5 py-2.5 text-sm" onClick={save} disabled={saving || !pin}>
          <Save className="size-4" /> {saving ? 'Saving…' : 'Save online'}
        </button>
        <button type="button" className="btn-ghost-quest px-4 py-2 text-sm" onClick={exportJson}>
          <Download className="size-4" /> Export
        </button>
        <button type="button" className="btn-ghost-quest px-4 py-2 text-sm" onClick={() => importRef.current?.click()}>
          <Upload className="size-4" /> Import
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importJson(f)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn-ghost-quest px-4 py-2 text-sm" onClick={resetDefaults}>
          <RotateCcw className="size-4" /> Defaults
        </button>
        <button
          type="button"
          className="btn-ghost-quest px-4 py-2 text-sm"
          onClick={() => {
            window.localStorage.removeItem(PROGRESS_KEY)
            toast.success('Game progress on this device was reset.')
          }}
        >
          Reset progress
        </button>
        <button type="button" className="btn-ghost-quest px-3 py-2 text-sm" onClick={onLock} aria-label="Lock host tools">
          <Lock className="size-4" />
        </button>
      </div>

      {/* General settings */}
      <details className="glass mt-4 rounded-2xl p-4">
        <summary className="cursor-pointer font-display font-extrabold text-white">Game settings</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextField label="Player full name" value={draft.playerName} onChange={(v) => update((c) => ({ ...c, playerName: v }))} />
          <TextField label="Nickname used in messages" value={draft.nickname} onChange={(v) => update((c) => ({ ...c, nickname: v }))} />
          <TextField label="Created by" value={draft.author} onChange={(v) => update((c) => ({ ...c, author: v }))} />
          <TextField
            label="Next stage link (optional)"
            placeholder="https://… — where CONTINUE TO THE NEXT STAGE goes"
            value={draft.nextStageUrl}
            onChange={(v) => update((c) => ({ ...c, nextStageUrl: v }))}
          />
        </div>
      </details>

      {/* Song tabs */}
      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {draft.songs.map((s, i) => {
          const count = questionsFor(s).length
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === songIdx}
              onClick={() => setSongIdx(i)}
              className={cn(
                'rounded-2xl border px-4 py-2.5 text-left transition-colors',
                i === songIdx ? 'border-pink-400 bg-pink-500/20' : 'border-white/15 bg-white/5 hover:bg-white/10',
              )}
            >
              <span className="block text-xs font-bold text-pink-200">Song {i + 1}</span>
              <span className="font-display font-extrabold text-white">{s.title}</span>
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-0.5 text-xs font-black',
                  count === QUESTIONS_PER_SONG ? 'bg-emerald-500/25 text-emerald-100' : 'bg-amber-500/25 text-amber-100',
                )}
              >
                {count}/{QUESTIONS_PER_SONG} blanks
              </span>
            </button>
          )
        })}
      </div>

      {allIssues[songIdx].length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-950/50 p-4 text-sm text-amber-100" role="alert">
          <p className="flex items-center gap-2 font-extrabold">
            <AlertTriangle className="size-4" /> Fix before Sir H plays
          </p>
          <ul className="mt-1 list-disc pl-6">
            {allIssues[songIdx].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {song && <SongEditor key={song.id + songIdx} song={song} updateSong={updateSong} />}
    </div>
  )
}

/* ───────────────────────── Song editor ───────────────────────── */

function SongEditor({ song, updateSong }: { song: Song; updateSong: (fn: (s: Song) => void) => void }) {
  const [videoInput, setVideoInput] = useState(`https://youtu.be/${song.videoId}`)
  const [playerState, setPlayerState] = useState<number>(YTState.UNSTARTED)
  const yt = useYouTubePlayer({ videoId: song.videoId, controls: true, onStateChange: (s) => setPlayerState(s) })
  const [time, setTime] = useState(0)
  const [reveal, setReveal] = useState(true)
  const [testMode, setTestMode] = useState(false)
  const [preview, setPreview] = useState<Question | null>(null)
  const [stampAt, setStampAt] = useState(0)
  const prevT = useRef(0)
  const testRef = useRef(testMode)
  useEffect(() => {
    testRef.current = testMode
  }, [testMode])

  const questions = useMemo(() => questionsFor(song), [song])
  const questionsRef = useRef(questions)
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  // Poll playback time; in test mode pause at each question like the real game.
  useEffect(() => {
    if (!yt.ready) return
    const id = window.setInterval(() => {
      const p = yt.playerRef.current
      if (!p) return
      let t = 0
      try {
        t = p.getCurrentTime() || 0
      } catch {
        return
      }
      const before = prevT.current
      prevT.current = t
      setTime(t)
      if (!testRef.current || t - before <= 0 || t - before > 1.5) return
      const hit = questionsRef.current.find((q) => before < q.pauseAt && q.pauseAt <= t)
      if (hit) {
        p.pauseVideo()
        setPreview(hit)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [yt.ready, yt.playerRef])

  const player = () => yt.playerRef.current
  const now = () => Math.round((player()?.getCurrentTime() ?? time) * 10) / 10
  const seek = (t: number, playAfter = true) => {
    const p = player()
    if (!p) return
    prevT.current = Math.max(0, t)
    p.seekTo(Math.max(0, t), true)
    if (playAfter) p.playVideo()
  }
  const isPlaying = playerState === YTState.PLAYING || playerState === YTState.BUFFERING

  const setLine = (i: number, patch: Partial<LyricLine>) =>
    updateSong((s) => {
      s.lines[i] = { ...s.lines[i], ...patch }
    })

  const stamp = useCallback(() => {
    const t = Math.round(((yt.playerRef.current?.getCurrentTime() ?? 0) - song.offset) * 10) / 10
    const i = stampAt
    if (i >= song.lines.length) return
    updateSong((s) => {
      s.lines[i].time = Math.max(0, t)
    })
    setStampAt(i + 1)
  }, [stampAt, song.lines.length, song.offset, updateSong, yt.playerRef])

  // Space bar stamps the next line while the host listens (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.code !== 'Space' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      stamp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stamp])

  const previewQuestion = (q: Question) => {
    setTestMode(true)
    setPreview(null)
    seek(q.pauseAt - 5)
  }

  return (
    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Player + live preview */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="relative aspect-video bg-black/60">
            <div ref={yt.hostRef} className="absolute inset-0 [&_iframe]:size-full" />
          </div>
          {yt.error && (
            <p className="flex items-center gap-2 p-3 text-sm font-bold text-amber-200" role="alert">
              <AlertTriangle className="size-4" /> {yt.error}
              <button type="button" className="underline" onClick={yt.retry}>
                Retry
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 p-3">
            <span className="mr-auto rounded-lg bg-black/40 px-2.5 py-1 font-mono text-lg font-bold text-amber-100" aria-live="off">
              {formatTime(time)} <span className="text-xs text-violet-200">({time.toFixed(1)}s)</span>
            </span>
            {[-5, -1, 1, 5].map((d) => (
              <button key={d} type="button" className="btn-ghost-quest px-2.5 py-1 text-xs" onClick={() => seek(time + d, isPlaying)}>
                {d > 0 ? `+${d}` : d}s
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost-quest px-3 py-1 text-xs"
              onClick={() => (isPlaying ? player()?.pauseVideo() : player()?.playVideo())}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => {
                setTestMode((v) => !v)
                setPreview(null)
              }}
              className={cn('btn-ghost-quest px-3 py-1.5 text-xs', testMode && 'border-pink-400 bg-pink-500/30')}
            >
              <FlaskConical className="size-4" /> Test mode {testMode ? 'ON' : 'off'}
            </button>
            <button type="button" className="btn-ghost-quest px-3 py-1.5 text-xs" onClick={() => {
              setTestMode(true)
              setPreview(null)
              seek(0)
            }}>
              <Play className="size-4" /> Test from start
            </button>
            <button type="button" className="btn-ghost-quest px-3 py-1.5 text-xs" onClick={() => setReveal((v) => !v)}>
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {reveal ? 'Hide' : 'Show'} answers
            </button>
          </div>
        </div>

        {preview && <QuestionPreview q={preview} onClose={() => setPreview(null)} onResume={() => {
          setPreview(null)
          seek(preview.pauseAt)
        }} />}

        <div className="glass overflow-hidden rounded-3xl">
          <p className="border-b border-white/10 px-5 py-2.5 text-xs font-extrabold tracking-[0.2em] text-violet-200 uppercase">
            Live sync preview · tap a line to jump
          </p>
          <LyricsDisplay
            song={song}
            time={time}
            solvedCount={reveal ? 99 : 0}
            activeQuestion={preview ? preview.index : null}
            revealAll={reveal}
            className="h-[38vh] min-h-[260px]"
            onLineClick={(i) => seek(lineStart(song, song.lines[i]) - 1.5)}
          />
        </div>
      </div>

      {/* Data editing */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="glass grid gap-3 rounded-3xl p-4 sm:grid-cols-2">
          <TextField label="Song title" value={song.title} onChange={(v) => updateSong((s) => void (s.title = v))} />
          <TextField label="Artist" value={song.artist} onChange={(v) => updateSong((s) => void (s.artist = v))} />
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-violet-200">YouTube link</label>
            <div className="mt-1 flex gap-2">
              <input
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-violet-300/30 bg-[#0b0a2a]/70 px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
              />
              <button
                type="button"
                className="btn-ghost-quest px-4 py-2 text-sm"
                onClick={() => {
                  const id = parseVideoId(videoInput)
                  if (!id) return toast.error('That doesn’t look like a YouTube link.')
                  updateSong((s) => void (s.videoId = id))
                  toast.success('Video updated.')
                }}
              >
                Use link
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-violet-200">
              Whole-song offset (seconds) — shifts every lyric and pause at once. Use + if lyrics appear too early.
            </label>
            <div className="mt-1 flex items-center gap-2">
              <NumberField value={song.offset} step={0.1} onChange={(v) => updateSong((s) => void (s.offset = Math.max(-60, Math.min(60, v))))} />
              {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn-ghost-quest px-2.5 py-1 text-xs"
                  onClick={() => updateSong((s) => void (s.offset = Math.round((s.offset + d) * 10) / 10))}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tap-to-sync */}
        <div className="glass rounded-3xl p-4">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <Stamp className="size-5 text-pink-300" /> Tap-to-sync
          </p>
          <p className="mt-1 text-sm text-violet-100/80">
            Play the song and press <kbd className="rounded bg-white/15 px-1.5">Space</kbd> (or the button) the moment each
            line starts. The time is saved to the highlighted line and moves to the next one.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-violet-100" htmlFor="stamp-from">
              Next line to stamp:
            </label>
            <select
              id="stamp-from"
              value={stampAt}
              onChange={(e) => setStampAt(Number(e.target.value))}
              className="h-10 max-w-[16rem] rounded-xl border border-violet-300/30 bg-[#0b0a2a] px-2 text-sm text-white"
            >
              {song.lines.map((l, i) => (
                <option key={l.id} value={i}>
                  {i + 1}. {l.text.slice(0, 32)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost-quest px-3 py-2 text-sm"
              onClick={() => seek(Math.max(0, lineStart(song, song.lines[stampAt] ?? song.lines[0]) - 6))}
            >
              <Play className="size-4" /> Play from just before
            </button>
            <button type="button" className="btn-quest px-5 py-2.5 text-sm" onClick={stamp} disabled={stampAt >= song.lines.length}>
              <Stamp className="size-4" /> Stamp line {Math.min(stampAt + 1, song.lines.length)}
            </button>
          </div>
        </div>

        {/* Lines */}
        <div className="glass rounded-3xl p-2 sm:p-4">
          <ol className="flex flex-col gap-2">
            {song.lines.map((line, i) => {
              const q = questions.find((x) => x.lineIndex === i)
              const invalid = line.blank && !splitBlank(line.text, line.blank.answer)
              return (
                <li
                  key={line.id}
                  className={cn(
                    'rounded-2xl border p-3',
                    i === stampAt ? 'border-amber-300/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]',
                    line.blank && 'border-pink-400/50 bg-pink-500/10',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-7 text-right text-xs font-black text-violet-300">{i + 1}</span>
                    <NumberField value={line.time} step={0.1} onChange={(v) => setLine(i, { time: Math.max(0, v) })} label={`Line ${i + 1} start time`} />
                    <button type="button" className="btn-ghost-quest px-2 py-1 text-xs" title="Set to current video time" onClick={() => setLine(i, { time: Math.max(0, now() - song.offset) })}>
                      <Clock className="size-3.5" /> now
                    </button>
                    <button type="button" className="btn-ghost-quest px-2 py-1 text-xs" title="Play this line" onClick={() => seek(lineStart(song, line) - 1.5)}>
                      <Play className="size-3.5" />
                    </button>
                    <input
                      value={line.text}
                      onChange={(e) => setLine(i, { text: e.target.value })}
                      aria-label={`Line ${i + 1} lyric`}
                      className="h-9 min-w-[12rem] flex-1 rounded-lg border border-violet-300/25 bg-[#0b0a2a]/70 px-3 text-sm font-bold text-white focus:border-pink-400 focus:outline-none"
                    />
                    <input
                      value={line.section ?? ''}
                      onChange={(e) => setLine(i, { section: e.target.value || null })}
                      placeholder="Section"
                      aria-label={`Line ${i + 1} section label`}
                      className="h-9 w-24 rounded-lg border border-violet-300/25 bg-[#0b0a2a]/70 px-2 text-xs text-white focus:border-pink-400 focus:outline-none"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-bold text-pink-100">
                      <input
                        type="checkbox"
                        checked={!!line.blank}
                        onChange={(e) =>
                          setLine(i, {
                            blank: e.target.checked
                              ? { answer: line.text.split(' ').at(-1) ?? line.text, accept: [], pauseAt: null }
                              : null,
                          })
                        }
                        className="size-4 accent-pink-500"
                      />
                      Missing lyric
                    </label>
                    <button
                      type="button"
                      className="btn-ghost-quest px-2 py-1 text-xs"
                      aria-label={`Add a line after line ${i + 1}`}
                      onClick={() =>
                        updateSong((s) => {
                          s.lines.splice(i + 1, 0, {
                            id: `n${Date.now().toString(36)}`,
                            time: Math.round((line.time + 3) * 10) / 10,
                            text: 'New line',
                            section: null,
                            blank: null,
                          })
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-quest px-2 py-1 text-xs"
                      aria-label={`Delete line ${i + 1}`}
                      disabled={song.lines.length <= 1}
                      onClick={() => updateSong((s) => void s.lines.splice(i, 1))}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {line.blank && (
                    <div className="mt-2 grid gap-2 pl-9 sm:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="text-[11px] font-bold text-pink-200">Hidden word / phrase (must be in the line)</label>
                        <input
                          value={line.blank.answer}
                          onChange={(e) => setLine(i, { blank: { ...line.blank!, answer: e.target.value } })}
                          className={cn(
                            'mt-0.5 h-9 w-full rounded-lg border bg-[#0b0a2a]/70 px-3 text-sm font-bold text-white focus:outline-none',
                            invalid ? 'border-amber-400' : 'border-pink-300/40 focus:border-pink-400',
                          )}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-pink-200">Also accept (comma-separated)</label>
                        <CommaField
                          value={line.blank.accept}
                          onChange={(accept) => setLine(i, { blank: { ...line.blank!, accept } })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-pink-200">Pause at (s, empty = auto)</label>
                        <div className="mt-0.5 flex items-center gap-1">
                          <NumberField
                            value={line.blank.pauseAt}
                            allowEmpty
                            step={0.1}
                            onChange={(v) => setLine(i, { blank: { ...line.blank!, pauseAt: Number.isNaN(v) ? null : Math.max(0, v) } })}
                            label={`Line ${i + 1} pause time`}
                          />
                          <button type="button" className="btn-ghost-quest px-2 py-1 text-xs" title="Pause at the current video time" onClick={() => setLine(i, { blank: { ...line.blank!, pauseAt: Math.max(0, now() - song.offset) } })}>
                            <Clock className="size-3.5" />
                          </button>
                          {q && (
                            <button type="button" className="btn-ghost-quest px-2 py-1 text-xs" onClick={() => previewQuestion(q)}>
                              <Eye className="size-3.5" /> Preview Q{q.index + 1}
                            </button>
                          )}
                        </div>
                        {q && (
                          <p className="mt-0.5 text-[11px] text-violet-200/70">
                            Pauses at {formatTime(q.pauseAt)} · resumes from there
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

function QuestionPreview({ q, onClose, onResume }: { q: Question; onClose: () => void; onResume: () => void }) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
  const parts = splitBlank(q.line.text, q.blank.answer)
  return (
    <div className="glass pop-in rounded-3xl border-pink-400/50 p-5">
      <div className="flex items-center justify-between">
        <p className="title-glow text-xl font-black">FILL IN THE BLANK!</p>
        <span className="text-xs font-bold text-pink-100">Preview · Question {q.index + 1}/{QUESTIONS_PER_SONG}</span>
      </div>
      <p className="mt-3 text-lg font-extrabold text-white">
        “{parts?.before}
        <span className="blank-slot blank-active">______</span>
        {parts?.after}”
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setResult(isCorrectAnswer(value, q.blank))
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Try an answer…"
          aria-label="Test answer"
          className="h-11 min-w-0 flex-1 rounded-xl border-2 border-violet-300/40 bg-[#0b0a2a]/70 px-3 font-bold text-white focus:border-pink-400 focus:outline-none"
        />
        <button type="submit" className="btn-quest px-4 py-2 text-sm">
          SUBMIT ANSWER
        </button>
      </form>
      {result != null && (
        <p className={cn('mt-2 flex items-center gap-1.5 text-sm font-extrabold', result ? 'text-emerald-200' : 'text-amber-200')}>
          {result ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          {result ? 'Accepted as correct' : 'Would be marked wrong'}
        </p>
      )}
      <p className="mt-2 text-xs text-violet-200/75">
        Paused at {formatTime(q.pauseAt)} · line starts {formatTime(q.lineStart)} · answer “{q.blank.answer}”
        {q.blank.accept.length > 0 && ` (also: ${q.blank.accept.join(', ')})`}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-ghost-quest px-3 py-1.5 text-xs" onClick={onResume}>
          <Play className="size-3.5" /> Resume like the game
        </button>
        <button type="button" className="btn-ghost-quest px-3 py-1.5 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── Small fields ───────────────────────── */

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-violet-200">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-violet-300/30 bg-[#0b0a2a]/70 px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
      />
    </label>
  )
}

/** Numeric input that only commits on blur/Enter, so typing "12." isn't fought. */
function NumberField({
  value,
  onChange,
  step = 0.1,
  allowEmpty = false,
  label,
}: {
  value: number | null
  onChange: (v: number) => void
  step?: number
  allowEmpty?: boolean
  label?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])
  const commit = () => {
    if (text.trim() === '' && allowEmpty) return onChange(Number.NaN)
    const n = Number.parseFloat(text)
    if (Number.isFinite(n)) onChange(Math.round(n * 100) / 100)
    else setText(value == null ? '' : String(value))
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      aria-label={label}
      placeholder={allowEmpty ? 'auto' : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="h-9 w-24 rounded-lg border border-violet-300/25 bg-[#0b0a2a]/70 px-2 font-mono text-sm text-amber-100 focus:border-pink-400 focus:outline-none"
    />
  )
}

function CommaField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const joined = value.join(', ')
  const [text, setText] = useState(joined)
  useEffect(() => {
    setText(joined)
  }, [joined])
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
      placeholder="e.g. a hero"
      className="mt-0.5 h-9 w-full rounded-lg border border-pink-300/40 bg-[#0b0a2a]/70 px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
    />
  )
}
