import type { Blank } from '@/lib/game-config'

/** Lowercases, strips accents/punctuation and collapses whitespace. */
export function normalizeAnswer(input: string) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Case-, spacing- and punctuation-insensitive comparison against all accepted answers. */
export function isCorrectAnswer(input: string, blank: Blank) {
  const guess = normalizeAnswer(input)
  if (!guess) return false
  const squash = (s: string) => s.replace(/\s/g, '')
  return [blank.answer, ...blank.accept].some((option) => {
    const target = normalizeAnswer(option)
    return target === guess || squash(target) === squash(guess)
  })
}

/** Shown after each correct answer — message N goes with question N of a song. */
export const correctMessages = [
  'Tama! Galing, Sir H! Keep the rhythm going!',
  'Yes! Nakuha mo! Ang galing ng musical memory mo!',
  'Perfect! Mukhang kabisado mo ang melody!',
  'Very good, Sir H! Tuloy-tuloy lang!',
  "Correct! You're doing great! Next lyric naman!",
  'Wow! Ang bilis mo! Music master in the making!',
  'Excellent! Konti na lang, malapit mo nang matapos!',
  'Amazing, Sir H! Na-perfect mo ang song!',
]

export const wrongMessages = [
  'Not quite, Sir H! Try again!',
  'Oops! Parang may kulang pa. Think again!',
  'Almost there! Listen carefully!',
  "Hindi pa iyan! Kaya mo 'yan, Sir H!",
  'The melody is waiting! One more try!',
  'Malapit na! Recall mo lang ang lyrics!',
]
