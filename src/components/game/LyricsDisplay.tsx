import { useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/utils'
import {
  currentLineIndex,
  lineProgress,
  questionsFor,
  splitBlank,
  type Song,
} from '@/lib/game-config'

type Props = {
  song: Song
  /** Effective playback time in seconds. */
  time: number
  /** Number of questions already answered correctly in this song. */
  solvedCount: number
  /** Question index currently waiting for an answer, or null. */
  activeQuestion: number | null
  /** Host preview: show the hidden words instead of blanks. */
  revealAll?: boolean
  className?: string
  onLineClick?: (lineIndex: number) => void
}

/** Karaoke-style, auto-scrolling lyric list with blanks for the missing words. */
export function LyricsDisplay({
  song,
  time,
  solvedCount,
  activeQuestion,
  revealAll = false,
  className,
  onLineClick,
}: Props) {
  const questions = useMemo(() => questionsFor(song), [song])
  const questionByLine = useMemo(() => {
    const map = new Map<number, number>()
    questions.forEach((q) => map.set(q.lineIndex, q.index))
    return map
  }, [questions])

  const activeLine = activeQuestion != null ? questions[activeQuestion]?.lineIndex : undefined
  const playingLine = currentLineIndex(song, time)
  const focusLine = activeLine ?? playingLine
  const progress = activeLine != null ? 0 : lineProgress(song, playingLine, time)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    const box = scrollRef.current
    const el = lineRefs.current[Math.max(0, focusLine)]
    if (!box || !el) return
    const top = el.offsetTop - box.clientHeight * 0.36 + el.clientHeight / 2
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [focusLine])

  return (
    <div
      ref={scrollRef}
      className={cn(
        'relative overflow-y-auto overscroll-contain scroll-smooth px-5 sm:px-8',
        '[mask-image:linear-gradient(to_bottom,transparent,black_12%,black_85%,transparent)]',
        className,
      )}
    >
      <div className="h-[30%] min-h-16" aria-hidden />
      {song.lines.map((line, i) => {
        const qIndex = questionByLine.get(i)
        const isQuestion = qIndex != null
        const solved = isQuestion && qIndex < solvedCount
        const isActiveBlank = isQuestion && qIndex === activeQuestion
        const isCurrent = i === focusLine
        const state = isCurrent ? 'current' : i < focusLine ? 'past' : 'upcoming'
        const parts = line.blank ? splitBlank(line.text, line.blank.answer) : null
        const showSection = line.section && line.section !== song.lines[i - 1]?.section

        return (
          <div key={line.id}>
            {showSection && (
              <p className="mt-6 mb-1 font-display text-xs font-bold tracking-[0.3em] text-pink-300/70 uppercase">
                {line.section}
              </p>
            )}
            <p
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              onClick={onLineClick ? () => onLineClick(i) : undefined}
              className={cn(
                'lyric-line my-3 text-[1.45rem] sm:text-3xl lg:text-[2.1rem]',
                `lyric-${state}`,
                isCurrent && 'text-[1.7rem] sm:text-[2.15rem] lg:text-[2.6rem]',
                onLineClick && 'cursor-pointer hover:opacity-100',
              )}
              style={isCurrent ? ({ '--p': `${Math.round(progress * 100)}%` } as React.CSSProperties) : undefined}
              aria-current={isCurrent ? 'true' : undefined}
            >
              {parts && !revealAll ? (
                <>
                  {parts.before}
                  {solved ? (
                    <span className="blank-solved">{parts.hidden}</span>
                  ) : (
                    <span
                      className={cn('blank-slot', isActiveBlank && 'blank-active')}
                      aria-label="missing lyric"
                    >
                      ______
                    </span>
                  )}
                  {parts.after}
                </>
              ) : parts && revealAll ? (
                <>
                  {parts.before}
                  <span className="blank-solved">{parts.hidden}</span>
                  {parts.after}
                </>
              ) : (
                line.text
              )}
            </p>
          </div>
        )
      })}
      <div className="h-[45%] min-h-24" aria-hidden />
    </div>
  )
}
