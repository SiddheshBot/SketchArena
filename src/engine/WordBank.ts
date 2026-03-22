/**
 * Curated word bank for the drawing game.
 * Words are grouped by perceived difficulty based on how easy they are to draw.
 */

const WORDS: string[] = [
  // Animals
  'cat', 'dog', 'fish', 'bird', 'snake', 'elephant', 'penguin', 'butterfly',
  'rabbit', 'turtle', 'horse', 'dolphin', 'spider', 'octopus', 'giraffe',

  // Objects
  'chair', 'lamp', 'umbrella', 'clock', 'key', 'book', 'phone', 'guitar',
  'camera', 'sword', 'crown', 'balloon', 'candle', 'hammer', 'glasses',

  // Food
  'pizza', 'apple', 'cake', 'banana', 'burger', 'ice cream', 'donut',
  'watermelon', 'cookie', 'popcorn', 'sushi', 'taco', 'pancake', 'cheese',

  // Nature
  'tree', 'flower', 'sun', 'moon', 'star', 'mountain', 'rainbow', 'cloud',
  'volcano', 'ocean', 'island', 'snowflake', 'lightning', 'cactus',

  // Transportation
  'car', 'airplane', 'bicycle', 'boat', 'rocket', 'train', 'helicopter',
  'submarine', 'skateboard', 'bus',

  // Buildings / Places
  'house', 'castle', 'bridge', 'lighthouse', 'tent', 'igloo', 'pyramid',

  // People / Characters
  'robot', 'pirate', 'wizard', 'astronaut', 'ninja', 'mermaid', 'ghost',
  'vampire', 'angel', 'clown',

  // Sports / Activities
  'soccer', 'basketball', 'surfing', 'skiing', 'bowling', 'fishing',
  'camping', 'karate', 'parachute',

  // Misc
  'diamond', 'treasure', 'tornado', 'fireworks', 'telescope', 'anchor',
  'compass', 'hourglass', 'maze', 'trophy', 'volcano', 'windmill',
];

/**
 * Fisher-Yates shuffle to pick N random words without repeats.
 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const result: T[] = [];

  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }

  return result;
}

/**
 * Returns 3 random word choices for the drawer to pick from.
 */
export function getWordChoices(): string[] {
  return pickRandom(WORDS, 3);
}
