import { useEffect, useRef, useState } from 'react'
import { Music2, Music4, Sparkles, Star } from 'lucide-react'

const COLORS = ['#ff7ac8', '#ffd36e', '#c9a2ff', '#7ee0ff', '#ff4fa3', '#ffffff']

type Piece = {
  id: number
  left: number
  delay: number
  duration: number
  dx: number
  rot: number
  color: string
  w: number
  h: number
  round: boolean
}

function makePieces(count: number, wave: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: wave * 1000 + i,
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 3.2 + Math.random() * 2.8,
    dx: (Math.random() - 0.5) * 260,
    rot: (Math.random() - 0.5) * 1440,
    color: COLORS[i % COLORS.length],
    w: 6 + Math.random() * 7,
    h: 10 + Math.random() * 10,
    round: Math.random() > 0.7,
  }))
}

export function Confetti({ waves = 3 }: { waves?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setPieces(makePieces(120, 0))
    let wave = 1
    const id = window.setInterval(() => {
      if (wave >= waves) return window.clearInterval(id)
      setPieces((p) => [...p.slice(-160), ...makePieces(70, wave)])
      wave += 1
    }, 2600)
    return () => window.clearInterval(id)
  }, [waves])

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.round ? p.w : p.h,
              borderRadius: p.round ? '999px' : '2px',
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--dx': `${p.dx}px`,
              '--rot': `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

type ModalProps = {
  nickname: string
  author: string
  onContinue: () => void
}

/** Final celebration shown only after all 16 lyrics are answered correctly. */
export function CongratsModal({ nickname, author, onContinue }: ModalProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btnRef.current?.focus()
  }, [])
  const upper = nickname.toUpperCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#07061c]/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="congrats-title"
    >
      <Confetti />
      {/* floating music notes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[
          { Icon: Music2, cls: 'left-[8%] top-[18%] size-10 text-pink-300' },
          { Icon: Music4, cls: 'right-[10%] top-[12%] size-12 text-amber-200' },
          { Icon: Music2, cls: 'left-[14%] bottom-[14%] size-8 text-violet-300' },
          { Icon: Star, cls: 'right-[16%] bottom-[18%] size-9 text-amber-200' },
          { Icon: Sparkles, cls: 'left-[46%] top-[6%] size-8 text-pink-200' },
        ].map(({ Icon, cls }, i) => (
          <Icon
            key={i}
            className={`float-note absolute ${cls}`}
            style={{ animationDelay: `${i * 0.9}s` }}
          />
        ))}
      </div>

      <div className="glass pop-in relative my-auto w-full max-w-xl rounded-[2rem] px-6 py-9 text-center sm:px-10 sm:py-12">
        <div className="mx-auto -mt-16 mb-4 grid size-20 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 shadow-[0_0_40px_rgba(255,100,200,0.6)] ring-4 ring-amber-200/70 sm:-mt-20 sm:size-24">
          <Music4 className="size-10 text-white sm:size-12" />
        </div>

        <h2
          id="congrats-title"
          className="title-glow text-3xl leading-tight font-black sm:text-4xl"
        >
          CONGRATULATIONS, {upper}!
        </h2>

        <p className="mt-5 text-lg font-extrabold text-amber-100 sm:text-xl">
          You finished this stage of Music Intelligence!
        </p>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-violet-100/90 sm:text-lg">
          I hope you enjoyed this stage. You may now proceed to the next part of the game.
        </p>
        <p className="mt-6 font-display text-lg font-extrabold tracking-wide text-pink-200 sm:text-xl">
          GOOD LUCK AND GOD BLESS YOU, {upper}!
        </p>
        <p className="mt-5 font-display text-base text-violet-200/90 italic">— By {author}</p>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-emerald-200">
          <Star className="size-4 fill-current" /> 16 / 16 lyrics completed{' '}
          <Star className="size-4 fill-current" />
        </div>

        <button ref={btnRef} type="button" className="btn-quest mt-7 w-full sm:w-auto" onClick={onContinue}>
          CONTINUE TO THE NEXT STAGE
        </button>
      </div>
    </div>
  )
}
