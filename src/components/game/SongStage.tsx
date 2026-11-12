import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Pause, Play, RotateCcw, Send, Sparkles } from 'lucide-react'

import { LyricsDisplay } from '@/components/game/LyricsDisplay'
import { correctMessages, isCorrectAnswer, wrongMessages } from '@/lib/answers'
import { QUESTIONS_PER_SONG, questionsFor, splitBlank, type Song } from '@/lib/game-config'
import { cn } from '@/lib/utils'
import { YTState, useYouTubePlayer, type YTPlayer } from '@/lib/youtube'

type Phase = 'ready' | 'playing' | 'question' | 'done'
type Feedback = { kind: 'correct' | 'wrong'; text: string; key: number } | null

type Props = {
  song: Song
  songIndex: number
  totalSongs: number
  nickname: string
  /** Questions already answered (when resuming a saved game). */
  startSolved: number
  onProgress: (solved: number) => void
  /** Called a few seconds after the 8th correct answer. */
  onComplete: () => void
}

const TICK_MS = 100
/** Seconds of the song replayed by "Hear it again". */
const REPLAY_SECONDS = 8

export function SongStage({
  song,
  songIndex,
  totalSongs,
  nickname,
  startSolved,
  onProgress,
  onComplete,
}: Props) {
  const questions = useMemo(() => questionsFor(song), [song])
  const [phase, setPhase] = useState<Phase>('ready')
  const [solved, setSolved] = useState(Math.min(startSolved, questions.length))
  const [time, setTime] = useState(0)
  const [playerState, setPlayerState] = useState<number>(YTState.UNSTARTED)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [answer, setAnswer] = useState('')
  const [shaking, setShaking] = useState(false)
  const [stalled, setStalled] = useState(false)

  // Refs mirror state for the polling loop and YouTube callbacks.
  const phaseRef = useRef<Phase>('ready')
  const solvedRef = useRef(solved)
  /** Question index whose pause already fired — prevents duplicate triggers. */
  const triggeredRef = useRef(-1)
  const lastWrongRef = useRef(-1)
  /** Ignore pause checks briefly after a seek, while the player still reports the old time. */
  const settleUntilRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const lyricsRef = useRef<HTMLElement>(null)

  const goPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const onStateChange = useCallback((s: number, player: YTPlayer) => {
    setPlayerState(s)
    // Keep the music paused while a question is open.
    if (phaseRef.current === 'question' && s === YTState.PLAYING) player.pauseVideo()
    // Song ended with questions left (e.g. timestamps past the end): open the next one.
    if (s === YTState.ENDED && phaseRef.current === 'playing' && solvedRef.current < questions.length) {
      triggeredRef.current = solvedRef.current
      phaseRef.current = 'question'
      setPhase('question')
    }
  }, [questions.length])

  const yt = useYouTubePlayer({ videoId: song.videoId, onStateChange })

  // Polling loop: sync lyrics and fire pauses at the designated timestamps.
  useEffect(() => {
    if (!yt.ready) return
    const id = window.setInterval(() => {
      const player = yt.playerRef.current
      if (!player) return
      let t = 0
      try {
        t = player.getCurrentTime() || 0
      } catch {
        return
      }
      if (phaseRef.current === 'question') return
      setTime(t)
      if (phaseRef.current !== 'playing') return
      const q = questions[solvedRef.current]
      if (!q || triggeredRef.current === q.index) return
      if (performance.now() < settleUntilRef.current) return
      if (t >= q.pauseAt - 0.05) {
        triggeredRef.current = q.index
        player.pauseVideo()
        // Never let the song run (or be dragged) past an unanswered blank.
        if (t > q.pauseAt + 0.75) {
          player.seekTo(q.pauseAt, true)
          t = q.pauseAt
        }
        setTime(t)
        phaseRef.current = 'question'
        setPhase('question')
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [yt.ready, yt.playerRef, questions])

  // Focus the answer field and bring the panel into view on phones.
  useEffect(() => {
    if (phase !== 'question') return
    setAnswer('')
    const id = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      inputRef.current?.focus({ preventScroll: true })
    }, 250)
    return () => window.clearTimeout(id)
  }, [phase, solved])

  // Correct-answer toast fades by itself; wrong ones stay until the next try.
  useEffect(() => {
    if (feedback?.kind !== 'correct') return
    const id = window.setTimeout(() => setFeedback(null), 3200)
    return () => window.clearTimeout(id)
  }, [feedback])

  // After the last answer, let the line play, then hand over to the next screen.
  useEffect(() => {
    if (phase !== 'done') return
    const id = window.setTimeout(onComplete, 5000)
    return () => window.clearTimeout(id)
  }, [phase, onComplete])

  // Show a "continue" button only if playback stays stopped (e.g. a browser blocked autoplay).
  const isPlaying = playerState === YTState.PLAYING || playerState === YTState.BUFFERING
  useEffect(() => {
    setStalled(false)
    if (phase !== 'playing' || isPlaying || !yt.ready) return
    const id = window.setTimeout(() => setStalled(true), 1200)
    return () => window.clearTimeout(id)
  }, [phase, isPlaying, yt.ready])

  const play = () => yt.playerRef.current?.playVideo()

  const start = () => {
    const player = yt.playerRef.current
    if (!player) return
    const resumeFrom = solved > 0 ? questions[solved - 1]?.pauseAt ?? 0 : 0
    triggeredRef.current = -1
    settleUntilRef.current = performance.now() + 700
    if (resumeFrom > 0) player.seekTo(resumeFrom, true)
    goPhase(solved >= questions.length ? 'done' : 'playing')
    player.playVideo()
    // On phones the video sits above the lyrics — bring the lyrics into view.
    if (window.innerWidth < 1024) {
      lyricsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const togglePause = () => {
    const player = yt.playerRef.current
    if (!player || phaseRef.current !== 'playing') return
    if (playerState === YTState.PLAYING || playerState === YTState.BUFFERING) player.pauseVideo()
    else player.playVideo()
  }

  const replay = () => {
    const player = yt.playerRef.current
    const q = questions[solvedRef.current]
    if (!player || !q) return
    triggeredRef.current = -1
    setFeedback(null)
    settleUntilRef.current = performance.now() + 700
    player.seekTo(Math.max(0, q.pauseAt - REPLAY_SECONDS), true)
    goPhase('playing')
    player.playVideo()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phaseRef.current !== 'question') return
    const q = questions[solvedRef.current]
    if (!q) return
    if (!answer.trim()) {
      setShaking(true)
      inputRef.current?.focus()
      return
    }
    if (!isCorrectAnswer(answer, q.blank)) {
      let pick = Math.floor(Math.random() * wrongMessages.length)
      if (pick === lastWrongRef.current) pick = (pick + 1) % wrongMessages.length
      lastWrongRef.current = pick
      setFeedback({ kind: 'wrong', text: wrongMessages[pick], key: Date.now() })
      setShaking(true)
      inputRef.current?.select()
      return
    }

    const next = q.index + 1
    solvedRef.current = next
    setSolved(next)
    onProgress(next)
    setFeedback({
      kind: 'correct',
      text: correctMessages[q.index % correctMessages.length],
      key: Date.now(),
    })
    inputRef.current?.blur()
    goPhase(next >= questions.length ? 'done' : 'playing')
    // Resume from the designated timestamp, inside the tap so mobile allows playback.
    const player = yt.playerRef.current
    if (player) {
      settleUntilRef.current = performance.now() + 700
      player.seekTo(q.pauseAt, true)
      player.playVideo()
    }
  }

  const activeQ = phase === 'question' ? questions[solved] : undefined
  const parts = activeQ ? splitBlank(activeQ.line.text, activeQ.blank.answer) : null
  const questionNo = Math.min(solved + 1, QUESTIONS_PER_SONG)
  const overall = songIndex * QUESTIONS_PER_SONG + solved
  const overallTotal = totalSongs * QUESTIONS_PER_SONG

  return (
    <div className="mx-auto grid w-full max-w-content gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-7">
      {/* ── Left: player + progress ── */}
      <aside className="flex flex-col gap-4">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="relative aspect-video w-full bg-black/60">
            <div ref={yt.hostRef} className="absolute inset-0 [&_iframe]:size-full" />
            {!yt.ready && !yt.error && (
              <div className="absolute inset-0 grid place-items-center text-sm font-bold text-violet-100">
                <span className="flex items-center gap-2">
                  <span className="size-3 animate-ping rounded-full bg-pink-400" /> Loading the song…
                </span>
              </div>
            )}
            {phase === 'question' && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#0b0a2a]/55 text-center font-display text-lg font-extrabold tracking-widest text-amber-100">
                ⏸ PAUSED
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs font-bold tracking-[0.25em] text-pink-300 uppercase">
              Song {songIndex + 1} of {totalSongs}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-white">{song.title}</h2>
            <p className="text-sm text-violet-200/80">{song.artist}</p>
          </div>
        </div>

        <ProgressCard
          songIndex={songIndex}
          questionNo={phase === 'done' ? QUESTIONS_PER_SONG : questionNo}
          solved={solved}
          overall={overall}
          overallTotal={overallTotal}
          total={questions.length}
        />

        {yt.error && (
          <div className="glass rounded-2xl border-red-400/40 p-4 text-sm" role="alert">
            <p className="flex items-center gap-2 font-extrabold text-red-200">
              <AlertTriangle className="size-4" /> The song couldn’t load
            </p>
            <p className="mt-1 text-violet-100/90">{yt.error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost-quest text-sm" onClick={yt.retry}>
                <RotateCcw className="size-4" /> Try again
              </button>
              <a
                className="btn-ghost-quest text-sm"
                href={`https://www.youtube.com/watch?v=${song.videoId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube
              </a>
            </div>
          </div>
        )}
      </aside>

      {/* ── Right: lyrics + question ── */}
      <section ref={lyricsRef} className="flex min-w-0 scroll-mt-3 flex-col gap-4">
        <div className="glass relative overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-8">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.25em] text-violet-200 uppercase">
              <Sparkles className="size-4 text-amber-200" /> Lyrics
            </p>
            {phase === 'playing' && (
              <button
                type="button"
                onClick={togglePause}
                className="btn-ghost-quest px-4 py-1.5 text-sm"
                aria-label={isPlaying ? 'Pause music' : 'Play music'}
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}
          </div>

          <LyricsDisplay
            song={song}
            time={time}
            solvedCount={solved}
            activeQuestion={activeQ ? activeQ.index : null}
            className="h-[46vh] min-h-[300px] sm:h-[52vh] lg:h-[58vh]"
          />

          {phase === 'ready' && (
            <div className="absolute inset-x-0 bottom-0 top-12 grid place-items-center bg-gradient-to-b from-[#120f3a]/70 to-[#0b0a2a]/90 p-6 text-center">
              <div className="pop-in">
                <p className="font-display text-sm font-bold tracking-[0.3em] text-pink-300 uppercase">
                  {solved > 0 ? 'Welcome back' : `Song ${songIndex + 1}`}
                </p>
                <p className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
                  {song.title}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-violet-100/85">
                  {solved > 0
                    ? `You already found ${solved} of ${questions.length} lyrics. The music picks up right where you left off.`
                    : `Sing along, ${nickname}! The music stops at each missing lyric — fill it in to keep going.`}
                </p>
                <button
                  type="button"
                  className="btn-quest mt-6"
                  onClick={start}
                  disabled={!yt.ready}
                >
                  <Play className="size-5 fill-current" />
                  {yt.ready ? (solved > 0 ? 'Resume the song' : 'Start the song') : 'Loading…'}
                </button>
              </div>
            </div>
          )}

          {phase === 'playing' && stalled && (
            <button
              type="button"
              onClick={play}
              className="btn-quest absolute bottom-5 left-1/2 z-10 -translate-x-1/2 shadow-2xl"
            >
              <Play className="size-5 fill-current" /> Continue the song
            </button>
          )}

          {feedback?.kind === 'correct' && (
            <div
              key={feedback.key}
              className="pop-in absolute inset-x-4 top-16 z-10 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-950/85 px-5 py-4 text-emerald-50 shadow-2xl backdrop-blur"
              role="status"
            >
              <CheckCircle2 className="size-7 shrink-0 text-emerald-300" />
              <p className="text-base font-extrabold sm:text-lg">{feedback.text}</p>
            </div>
          )}
        </div>

        {activeQ && parts && (
          <div
            ref={panelRef}
            className="glass pop-in scroll-mb-4 rounded-3xl border-pink-400/50 p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="title-glow text-2xl font-black tracking-wide sm:text-3xl">
                FILL IN THE BLANK!
              </p>
              <span className="rounded-full bg-pink-500/20 px-3 py-1 text-sm font-extrabold text-pink-100">
                Question {activeQ.index + 1}/{questions.length}
              </span>
            </div>

            <p className="mt-4 text-xl leading-snug font-extrabold text-white sm:text-2xl">
              “{parts.before}
              <span className="blank-slot blank-active">______</span>
              {parts.after}”
            </p>

            <form
              onSubmit={submit}
              onAnimationEnd={() => setShaking(false)}
              className={cn('mt-5 flex flex-col gap-3 sm:flex-row', shaking && 'shake')}
            >
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <input
                id="answer"
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type the missing lyric…"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-violet-300/40 bg-[#0b0a2a]/70 px-5 text-lg font-bold text-white placeholder:text-violet-200/50 focus:border-pink-400 focus:shadow-[0_0_0_4px_rgba(255,122,200,0.25)] focus:outline-none sm:text-xl"
              />
              <button type="submit" className="btn-quest h-14 shrink-0">
                <Send className="size-5" /> SUBMIT ANSWER
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div aria-live="assertive" className="min-h-7">
                {feedback?.kind === 'wrong' && (
                  <p key={feedback.key} className="pop-in text-base font-extrabold text-amber-200 sm:text-lg">
                    {feedback.text}
                  </p>
                )}
              </div>
              <button type="button" onClick={replay} className="btn-ghost-quest text-sm">
                <RotateCcw className="size-4" /> Hear it again
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="glass pop-in rounded-3xl p-5 text-center">
            <p className="font-display text-xl font-extrabold text-emerald-200">
              All {questions.length} lyrics found! 🎶
            </p>
            <p className="mt-1 text-violet-100/85">Enjoy the music for a moment…</p>
            <button type="button" className="btn-quest mt-4" onClick={onComplete}>
              Continue
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function ProgressCard({
  songIndex,
  questionNo,
  solved,
  total,
  overall,
  overallTotal,
}: {
  songIndex: number
  questionNo: number
  solved: number
  total: number
  overall: number
  overallTotal: number
}) {
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-base font-extrabold text-white">
          Song {songIndex + 1}: Question {questionNo}/{total}
        </p>
        <p className="text-sm font-bold text-violet-200">
          Overall {overall}/{overallTotal}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-8 gap-1.5" aria-label={`${solved} of ${total} lyrics found`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2.5 rounded-full transition-colors',
              i < solved
                ? 'bg-gradient-to-r from-pink-400 to-amber-300 shadow-[0_0_10px_rgba(255,122,200,0.6)]'
                : i === solved
                  ? 'bg-pink-300/40'
                  : 'bg-white/10',
            )}
          />
        ))}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 transition-[width] duration-700"
          style={{ width: `${(overall / overallTotal) * 100}%` }}
        />
      </div>
    </div>
  )
}
