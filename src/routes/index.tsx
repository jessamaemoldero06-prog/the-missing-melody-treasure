import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Brain, Crown, Headphones, Music2, Music4, Sparkles, Star, Swords, User } from 'lucide-react'

import { CongratsModal, Confetti } from '@/components/game/Celebration'
import { SongStage } from '@/components/game/SongStage'
import { QUESTIONS_PER_SONG } from '@/lib/game-config'
import { useGameConfig } from '@/lib/use-game-config'

export const Route = createFileRoute('/')({
  component: Home,
})

type Screen = 'welcome' | 'song' | 'transition' | 'celebrate' | 'finished'
type Progress = { songIndex: number; solved: number; finished: boolean }

const PROGRESS_KEY = 'ftl-progress-v1'
const freshProgress: Progress = { songIndex: 0, solved: 0, finished: false }

function readProgress(): Progress | null {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Progress
    if (typeof p.songIndex !== 'number' || typeof p.solved !== 'number') return null
    return p
  } catch {
    return null
  }
}

function Home() {
  const { config } = useGameConfig()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [progress, setProgress] = useState<Progress>(freshProgress)
  const [saved, setSaved] = useState<Progress | null>(null)

  // Saved progress lives in this browser only (read after hydration).
  useEffect(() => {
    setSaved(readProgress())
  }, [])

  const persist = useCallback((p: Progress) => {
    setProgress(p)
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
    } catch {
      /* private mode — progress just isn't remembered */
    }
  }, [])

  const song = config.songs[progress.songIndex]
  const totalSongs = config.songs.length
  const overall = progress.songIndex * QUESTIONS_PER_SONG + progress.solved
  const overallTotal = totalSongs * QUESTIONS_PER_SONG

  const begin = (from: Progress) => {
    persist(from)
    if (from.finished) setScreen('finished')
    else setScreen('song')
    window.scrollTo({ top: 0 })
  }

  const handleProgress = useCallback(
    (solved: number) => persist({ ...progress, solved }),
    [persist, progress],
  )

  const handleSongComplete = useCallback(() => {
    if (progress.solved < QUESTIONS_PER_SONG) return
    if (progress.songIndex < totalSongs - 1) {
      setScreen('transition')
    } else {
      persist({ ...progress, finished: true })
      setScreen('celebrate')
    }
  }, [progress, totalSongs, persist])

  const nextSong = () => {
    persist({ songIndex: progress.songIndex + 1, solved: 0, finished: false })
    setScreen('song')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const continueToNextStage = () => {
    if (config.nextStageUrl) window.location.href = config.nextStageUrl
    else setScreen('finished')
  }

  const playAgain = () => {
    persist(freshProgress)
    setSaved(null)
    setScreen('welcome')
  }

  const allDone = progress.finished || overall >= overallTotal

  return (
    <div className="relative min-h-dvh overflow-x-hidden text-foreground">
      <div className="quest-bg" aria-hidden />
      <TopBar
        nickname={config.nickname}
        showProgress={screen !== 'welcome'}
        overall={overall}
        overallTotal={overallTotal}
      />

      <main className="pt-4 sm:pt-6">
        {screen === 'welcome' && (
          <Welcome
            playerName={config.playerName}
            nickname={config.nickname}
            author={config.author}
            songs={config.songs.map((s) => `${s.title} — ${s.artist}`)}
            saved={saved}
            onStart={() => begin(freshProgress)}
            onResume={() => saved && begin(saved)}
          />
        )}

        {/* Song stays mounted under the celebration so the music keeps playing. */}
        {(screen === 'song' || screen === 'celebrate' || screen === 'transition') && song && (
          <SongStage
            key={`${song.id}-${progress.songIndex}`}
            song={song}
            songIndex={progress.songIndex}
            totalSongs={totalSongs}
            nickname={config.nickname}
            startSolved={progress.solved}
            onProgress={handleProgress}
            onComplete={handleSongComplete}
          />
        )}

        {screen === 'transition' && (
          <SongTransition
            nickname={config.nickname}
            doneTitle={song?.title ?? ''}
            nextTitle={config.songs[progress.songIndex + 1]?.title ?? ''}
            nextArtist={config.songs[progress.songIndex + 1]?.artist ?? ''}
            overall={overall}
            overallTotal={overallTotal}
            onNext={nextSong}
          />
        )}

        {screen === 'celebrate' && allDone && (
          <CongratsModal
            nickname={config.nickname}
            author={config.author}
            onContinue={continueToNextStage}
          />
        )}

        {screen === 'finished' && (
          <Finished nickname={config.nickname} author={config.author} onReplay={playAgain} />
        )}
      </main>

      <footer className="px-4 pt-6 pb-8 text-center text-xs text-violet-200/60">
        A Musical Intelligence challenge created exclusively for {config.nickname} by{' '}
        {config.author}.{' '}
        <Link to="/host" className="underline-offset-4 hover:text-violet-100 hover:underline">
          Host setup
        </Link>
      </footer>
    </div>
  )
}

function TopBar({
  nickname,
  showProgress,
  overall,
  overallTotal,
}: {
  nickname: string
  showProgress: boolean
  overall: number
  overallTotal: number
}) {
  return (
    <header className="mx-auto flex w-full max-w-content items-center justify-between gap-3 px-4 pt-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 shadow-[0_0_24px_rgba(255,100,200,0.45)]">
          <Music4 className="size-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-extrabold tracking-wider text-white sm:text-base">
            FINISH THE LYRICS
          </p>
          <p className="text-[11px] font-bold tracking-[0.2em] text-pink-200/80 uppercase">
            {nickname}’s Musical Quest
          </p>
        </div>
      </div>
      {showProgress && (
        <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-extrabold text-amber-100">
          <Star className="size-4 fill-amber-200 text-amber-200" />
          <span className="hidden sm:inline">Overall progress:</span> {overall}/{overallTotal}
        </div>
      )}
    </header>
  )
}

function Welcome({
  playerName,
  nickname,
  author,
  songs,
  saved,
  onStart,
  onResume,
}: {
  playerName: string
  nickname: string
  author: string
  songs: string[]
  saved: Progress | null
  onStart: () => void
  onResume: () => void
}) {
  const canResume =
    saved && (saved.finished || saved.songIndex > 0 || saved.solved > 0)
  return (
    <section className="mx-auto max-w-content px-4 pb-10 sm:px-6">
      <div className="relative mx-auto max-w-3xl pt-6 text-center sm:pt-12">
        <Music2 className="float-note absolute top-4 left-2 size-8 text-pink-300/80 sm:left-10" aria-hidden />
        <Music4
          className="float-note absolute top-24 right-2 size-9 text-amber-200/80 sm:right-8"
          style={{ animationDelay: '1.5s' }}
          aria-hidden
        />
        <p className="inline-flex items-center gap-2 rounded-full border border-pink-300/30 bg-pink-500/10 px-4 py-1.5 text-xs font-extrabold tracking-[0.25em] text-pink-100 uppercase">
          <Sparkles className="size-3.5" /> A special quest for {nickname}
        </p>
        <h1 className="title-glow mt-5 text-[2.6rem] leading-[1.05] font-black sm:text-6xl lg:text-7xl">
          Finish the Lyrics
        </h1>
        <p className="mt-3 font-display text-lg font-bold tracking-[0.18em] text-violet-100 uppercase sm:text-xl">
          Music Intelligence Challenge
        </p>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-violet-100/85 sm:text-lg">
          Beyond the aurora lies the Castle of Melodies. Its gates open only for the one who can
          finish every song. Two songs. Sixteen missing lyrics. One challenger — {nickname}.
        </p>
      </div>

      <div className="mx-auto mt-9 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { Icon: User, label: 'Player', value: playerName },
          { Icon: Swords, label: 'Game', value: 'Finish the Lyrics' },
          { Icon: Brain, label: 'Category', value: 'Musical Intelligence' },
          { Icon: Crown, label: 'Mode', value: 'Single-player challenge' },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="glass rounded-2xl p-4">
            <Icon className="size-5 text-pink-300" />
            <p className="mt-2 text-[11px] font-extrabold tracking-[0.2em] text-violet-200/70 uppercase">
              {label}
            </p>
            <p className="font-display text-base font-extrabold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass mx-auto mt-6 max-w-4xl rounded-3xl p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-extrabold text-white">Your quest</h2>
            <ol className="mt-3 space-y-2.5 text-violet-100/90">
              {[
                'Listen and follow the glowing lyrics as the song plays.',
                'The music pauses at every missing lyric — type it and press SUBMIT ANSWER.',
                'A correct answer resumes the song. A wrong one lets you try again.',
                `Find all ${QUESTIONS_PER_SONG} lyrics in each song to unlock the next gate.`,
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pink-500/25 text-xs font-black text-pink-100">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold text-white">The songs</h2>
            <ul className="mt-3 space-y-2.5">
              {songs.map((s, i) => (
                <li key={s} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <Headphones className="size-5 shrink-0 text-amber-200" />
                  <span className="font-bold text-white">
                    <span className="text-pink-200">Song {i + 1}:</span> {s}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-violet-200/75">
              Turn your volume up — headphones make it even better.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {canResume ? (
            <>
              <button type="button" className="btn-quest w-full sm:w-auto" onClick={onResume}>
                {saved!.finished
                  ? 'View my completed stage'
                  : `Continue — Song ${saved!.songIndex + 1}, Question ${Math.min(saved!.solved + 1, QUESTIONS_PER_SONG)}`}
              </button>
              <button type="button" className="btn-ghost-quest w-full sm:w-auto" onClick={onStart}>
                Start over
              </button>
            </>
          ) : (
            <button type="button" className="btn-quest w-full text-lg sm:w-auto" onClick={onStart}>
              <Sparkles className="size-5" /> Begin the challenge
            </button>
          )}
        </div>
        <p className="mt-5 text-center text-sm text-violet-200/70 italic">
          Prepared with care for {nickname} by {author}
        </p>
      </div>
    </section>
  )
}

function SongTransition({
  nickname,
  doneTitle,
  nextTitle,
  nextArtist,
  overall,
  overallTotal,
  onNext,
}: {
  nickname: string
  doneTitle: string
  nextTitle: string
  nextArtist: string
  overall: number
  overallTotal: number
  onNext: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#07061c]/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-title"
    >
      <Confetti waves={1} />
      <div className="glass pop-in w-full max-w-lg rounded-[2rem] p-7 text-center sm:p-10">
        <p className="text-xs font-extrabold tracking-[0.3em] text-pink-300 uppercase">First gate unlocked</p>
        <h2 id="transition-title" className="title-glow mt-3 text-3xl font-black sm:text-4xl">
          Song 1 Complete!
        </h2>
        <p className="mt-4 text-lg text-violet-100/90">
          You finished every lyric of <span className="font-extrabold text-white">“{doneTitle}”</span>.
          Galing, {nickname}!
        </p>
        <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-extrabold text-amber-100">
          <Star className="size-4 fill-current" /> Overall progress: {overall}/{overallTotal}
        </div>
        <div className="mt-6 rounded-2xl bg-white/5 px-4 py-4">
          <p className="text-xs font-bold tracking-[0.2em] text-violet-200/70 uppercase">Up next — Song 2</p>
          <p className="mt-1 font-display text-xl font-extrabold text-white">{nextTitle}</p>
          <p className="text-sm text-violet-200/80">{nextArtist}</p>
        </div>
        <button type="button" className="btn-quest mt-7 w-full sm:w-auto" onClick={onNext} autoFocus>
          Proceed to Song 2
        </button>
      </div>
    </div>
  )
}

function Finished({
  nickname,
  author,
  onReplay,
}: {
  nickname: string
  author: string
  onReplay: () => void
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10 text-center sm:py-16">
      <div className="glass pop-in rounded-[2rem] p-8 sm:p-12">
        <Crown className="mx-auto size-12 text-amber-200" />
        <h1 className="title-glow mt-4 text-3xl font-black sm:text-5xl">Stage Complete</h1>
        <p className="mt-4 text-lg text-violet-100/90">
          The Castle of Melodies is open. {nickname} found all 16 missing lyrics in the Music
          Intelligence stage.
        </p>
        <p className="mt-6 font-display text-lg font-extrabold text-pink-200">
          GOOD LUCK AND GOD BLESS YOU, {nickname.toUpperCase()}!
        </p>
        <p className="mt-2 text-violet-200/80 italic">— By {author}</p>
        <button type="button" className="btn-ghost-quest mt-8" onClick={onReplay}>
          Play the stage again
        </button>
      </div>
    </section>
  )
}
