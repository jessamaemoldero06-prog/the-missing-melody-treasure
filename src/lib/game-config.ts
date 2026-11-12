import { z } from 'zod'

/**
 * Shape of the editable game data (lyrics, timestamps, blanks).
 * The default values live in `src/data/songs.ts`; the host can save an
 * edited copy from /host, which is stored in Netlify Blobs and served by
 * /api/config. The game logic only ever reads data through these types.
 */

export const QUESTIONS_PER_SONG = 8

/** How many seconds before a blank line starts the music pauses (default). */
export const DEFAULT_PAUSE_LEAD = 0.6

export const blankSchema = z.object({
  /** Exact word or phrase inside the line that gets hidden. */
  answer: z.string().trim().min(1).max(80),
  /** Extra answers that should also count as correct. */
  accept: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  /** Absolute video time (seconds, before song offset) to pause at. Defaults to line time − 0.6s. */
  pauseAt: z.number().min(0).max(36000).nullable().default(null),
})

export const lyricLineSchema = z.object({
  id: z.string().min(1).max(40),
  /** Video time in seconds when this line starts being sung. */
  time: z.number().min(0).max(36000),
  text: z.string().trim().min(1).max(200),
  /** Optional section label such as "Chorus" shown above the line. */
  section: z.string().trim().max(40).nullable().default(null),
  blank: blankSchema.nullable().default(null),
})

export const songSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().max(120),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  /** Seconds added to every timestamp. Use it to shift the whole song at once. */
  offset: z.number().min(-60).max(60).default(0),
  lines: z.array(lyricLineSchema).min(1).max(200),
})

export const gameConfigSchema = z.object({
  version: z.literal(1),
  playerName: z.string().trim().min(1).max(80),
  nickname: z.string().trim().min(1).max(40),
  author: z.string().trim().min(1).max(80),
  /** Where "CONTINUE TO THE NEXT STAGE" sends Sir H. Empty = stay on the finish screen. */
  nextStageUrl: z.string().trim().max(500).default(''),
  songs: z.array(songSchema).length(2),
})

export type Blank = z.infer<typeof blankSchema>
export type LyricLine = z.infer<typeof lyricLineSchema>
export type Song = z.infer<typeof songSchema>
export type GameConfig = z.infer<typeof gameConfigSchema>

export type Question = {
  /** 0-based index of the question inside its song. */
  index: number
  lineIndex: number
  line: LyricLine
  blank: Blank
  /** Effective video time (offset applied) when playback pauses. */
  pauseAt: number
  /** Effective video time when the line itself starts. */
  lineStart: number
}

export function lineStart(song: Song, line: LyricLine) {
  return Math.max(0, line.time + song.offset)
}

export function questionsFor(song: Song): Question[] {
  const out: Question[] = []
  song.lines.forEach((line, lineIndex) => {
    if (!line.blank) return
    const start = lineStart(song, line)
    const pause =
      line.blank.pauseAt != null
        ? Math.max(0, line.blank.pauseAt + song.offset)
        : Math.max(0, start - DEFAULT_PAUSE_LEAD)
    out.push({
      index: out.length,
      lineIndex,
      line,
      blank: line.blank,
      pauseAt: pause,
      lineStart: start,
    })
  })
  return out
}

/** Index of the line being sung at effective time `t` (−1 before the first line). */
export function currentLineIndex(song: Song, t: number) {
  let idx = -1
  for (let i = 0; i < song.lines.length; i++) {
    if (lineStart(song, song.lines[i]) <= t) idx = i
    else break
  }
  return idx
}

/** Fraction (0..1) of the current line that has elapsed, for the karaoke wipe. */
export function lineProgress(song: Song, index: number, t: number) {
  if (index < 0) return 0
  const start = lineStart(song, song.lines[index])
  const next = song.lines[index + 1]
  const end = next ? lineStart(song, next) : start + 5
  const span = Math.max(0.8, Math.min(end - start, 8))
  return Math.min(1, Math.max(0, (t - start) / span))
}

/** Splits a line into the text before/after the hidden phrase. */
export function splitBlank(text: string, answer: string) {
  const at = text.toLowerCase().indexOf(answer.toLowerCase())
  if (at < 0) return null
  return {
    before: text.slice(0, at),
    hidden: text.slice(at, at + answer.length),
    after: text.slice(at + answer.length),
  }
}

/** Problems the host should fix before the game is playable. */
export function validateSong(song: Song): string[] {
  const issues: string[] = []
  const qs = questionsFor(song)
  if (qs.length !== QUESTIONS_PER_SONG) {
    issues.push(
      `Needs exactly ${QUESTIONS_PER_SONG} missing lyrics (currently ${qs.length}).`,
    )
  }
  song.lines.forEach((line, i) => {
    if (i > 0 && line.time < song.lines[i - 1].time) {
      issues.push(`Line ${i + 1} starts before line ${i}. Keep timestamps in order.`)
    }
    if (line.blank && !splitBlank(line.text, line.blank.answer)) {
      issues.push(
        `Line ${i + 1}: the missing word “${line.blank.answer}” is not in the lyric text.`,
      )
    }
  })
  for (let i = 1; i < qs.length; i++) {
    if (qs[i].pauseAt <= qs[i - 1].pauseAt + 0.5) {
      issues.push(
        `Questions ${i} and ${i + 1} pause too close together. Space them at least 0.5s apart.`,
      )
    }
  }
  return issues
}

export function parseVideoId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    if (url.hostname.endsWith('youtu.be')) {
      const id = url.pathname.slice(1, 12)
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }
    const v = url.searchParams.get('v')
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
    const m = url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

export function formatTime(sec: number) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`
}
