import type { GameConfig, LyricLine } from '@/lib/game-config'

/**
 * DEFAULT GAME DATA — lyrics, timestamps, and missing words.
 *
 * Lyrics were supplied by the project owner. Timestamps are in seconds of
 * the YouTube video. Every song needs exactly 8 lines with a `blank`.
 *
 * You normally edit all of this from the Host Setup page (/host), which saves
 * an edited copy online. Edit this file only to change the built-in defaults.
 *
 *   line(time, text)                         – a normal lyric line
 *   line(time, text, { answer: 'word' })     – a missing-lyric question
 *   accept: ['alt']                          – other answers that also count
 *   pauseAt: 12.3                            – exact pause time (default: line time − 0.6s)
 *   section: 'Chorus'                        – optional label above the line
 */

let counter = 0
function line(
  time: number,
  text: string,
  blank?: { answer: string; accept?: string[]; pauseAt?: number },
  section: string | null = null,
): LyricLine {
  counter += 1
  return {
    id: `l${counter}`,
    time,
    text,
    section,
    blank: blank
      ? { answer: blank.answer, accept: blank.accept ?? [], pauseAt: blank.pauseAt ?? null }
      : null,
  }
}

export const defaultConfig: GameConfig = {
  version: 1,
  playerName: 'Sir Vincent Joshue Valino',
  nickname: 'Sir H',
  author: 'Jessamae Moldero',
  nextStageUrl: '',
  songs: [
    {
      id: 'valentine',
      title: 'Valentine',
      artist: 'Jim Brickman & Martina McBride',
      videoId: 'z3yjnDARHt0',
      offset: 0,
      lines: [
        line(13.6, 'If there were no words', { answer: 'words' }, 'Verse 1'),
        line(16.6, 'No way to speak'),
        line(19.9, 'I would still hear you'),
        line(23.9, 'If there were no tears', { answer: 'tears' }),
        line(26.8, 'No way to feel inside'),
        line(30.0, "I'd still feel for you"),
        line(33.1, 'And even if the sun refused to shine', { answer: 'shine' }, 'Chorus'),
        line(38.9, 'Even if romance ran out of rhyme', { answer: 'rhyme' }),
        line(45.0, 'I would give you my heart'),
        line(48.3, 'Until the end of time'),
        line(52.6, "'Cause all I need is you, my valentine"),
        line(69.5, 'All of my life', undefined, 'Verse 2'),
        line(72.3, 'I have been waiting for'),
        line(75.6, 'All you give to me'),
        line(79.3, "You've opened my eyes", { answer: 'eyes' }),
        line(82.2, 'And showed me how to love unselfishly'),
        line(88.3, "I've dreamed of this a thousand times before", {
          answer: 'thousand',
          accept: ['a thousand', 'thousand times'],
        }),
        line(94.0, "In my dreams, I couldn't love you more"),
        line(100.2, 'And I will give you my heart', { answer: 'heart' }),
        line(103.5, 'Until the end of time'),
        line(108.0, "'Cause all I need is you, my valentine"),
        line(133.6, 'And even if the sun refused to shine', undefined, 'Final Chorus'),
        line(139.2, 'Even if romance ran out of rhyme'),
        line(145.3, 'I would give you my heart'),
        line(148.4, 'Until the end of time'),
        line(153.8, "'Cause all I need is you, my valentine"),
        line(164.0, "You're all I need, my love, my valentine", {
          answer: 'love',
          accept: ['my love'],
        }),
      ],
    },
    {
      id: 'greatest-love-of-all',
      title: 'Greatest Love of All',
      artist: 'Whitney Houston',
      videoId: 'KLT_5y6Has0',
      offset: 0,
      lines: [
        line(17.6, 'I believe the children are our future', { answer: 'future' }, 'Verse 1'),
        line(21.3, 'Teach them well and let them lead the way'),
        line(25.0, 'Show them all the beauty they possess inside'),
        line(30.9, 'Give them a sense of pride to make it easier'),
        line(37.7, "Let the children's laughter remind us how we used to be"),
        line(47.1, "Everybody's searching for a hero", {
          answer: 'hero',
          accept: ['a hero'],
        }, 'Verse 2'),
        line(50.7, 'People need someone to look up to'),
        line(54.3, 'I never found anyone who fulfilled my needs'),
        line(60.0, 'A lonely place to be'),
        line(64.2, 'And so I learned to depend on me'),
        line(68.9, 'I decided long ago', undefined, 'Pre-Chorus'),
        line(72.1, "Never to walk in anyone's shadows", { answer: 'shadows', accept: ['shadow'] }),
        line(76.2, 'If I fail, if I succeed'),
        line(79.4, "At least I'll live as I believe"),
        line(82.8, 'No matter what they take from me'),
        line(86.7, "They can't take away my dignity", { answer: 'dignity' }),
        line(91.2, 'Because the greatest love of all', undefined, 'Chorus'),
        line(98.1, 'Is happening to me'),
        line(105.1, 'I found the greatest love of all'),
        line(112.9, 'Inside of me'),
        line(116.0, 'The greatest love of all'),
        line(123.7, 'Is easy to achieve', { answer: 'achieve' }),
        line(130.8, 'Learning to love yourself'),
        line(136.1, 'It is the greatest love of all'),
        line(144.4, 'I believe the children are our future', undefined, 'Verse 1'),
        line(147.9, 'Teach them well and let them lead the way'),
        line(151.7, 'Show them all the beauty they possess inside'),
        line(157.5, 'Give them a sense of pride to make it easier', {
          answer: 'pride',
          accept: ['a sense of pride'],
        }),
        line(164.3, "Let the children's laughter remind us how we used to be"),
        line(173.6, 'I decided long ago', undefined, 'Pre-Chorus'),
        line(176.8, "Never to walk in anyone's shadows"),
        line(180.7, 'If I fail, if I succeed'),
        line(183.9, "At least I'll live as I believe"),
        line(187.5, 'No matter what they take from me'),
        line(191.2, "They can't take away my dignity"),
        line(195.6, 'Because the greatest love of all', undefined, 'Chorus'),
        line(202.7, 'Is happening to me'),
        line(209.6, 'I found the greatest love of all'),
        line(217.4, 'Inside of me'),
        line(220.7, 'The greatest love of all'),
        line(228.0, 'Is easy to achieve'),
        line(235.3, 'Learning to love yourself', { answer: 'yourself', accept: ['your self'] }),
        line(240.7, 'It is the greatest love of all'),
        line(246.5, "And if by chance that special place", undefined, 'Outro'),
        line(253.9, "That you've been dreaming of"),
        line(261.4, 'Leads you to a lonely place'),
        line(267.0, 'Find your strength in love', { answer: 'strength' }),
      ],
    },
  ],
}
