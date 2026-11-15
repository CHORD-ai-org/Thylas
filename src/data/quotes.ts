/**
 * Moonshot thinking — the quotes on the login panel.
 *
 * Rules (docs/development/auth/LOGIN-PLAN.md §6):
 *   1. Every entry is a real sentence with a real source. No paraphrase, no
 *      assembled internet version.
 *   2. If a source cannot be named, the quote does not ship. Two well-known
 *      "moonshot" lines were dropped for exactly that reason: the Thiel 140/150
 *      characters variant and the Astro Teller 10× line only exist in
 *      second-hand retellings.
 *   3. Under 180 characters, so each one fits the panel without truncation.
 */
export type Quote = {
  id: string;
  text: string;
  author: string;
  year: string;
  source: string;
};

export const MOONSHOT_QUOTES: Quote[] = [
  {
    id: 'kay-predict',
    text: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
    year: '1971',
    source: 'Talk at Xerox PARC',
  },
  {
    id: 'shedd-harbor',
    text: 'A ship in harbor is safe, but that is not what ships are built for.',
    author: 'John A. Shedd',
    year: '1928',
    source: 'Salt from My Attic',
  },
  {
    id: 'shaw-unreasonable',
    text: 'The reasonable man adapts himself to the world; the unreasonable one persists in trying to adapt the world to himself. Therefore all progress depends on the unreasonable man.',
    author: 'George Bernard Shaw',
    year: '1903',
    source: 'Man and Superman',
  },
  {
    id: 'clarke-magic',
    text: 'Any sufficiently advanced technology is indistinguishable from magic.',
    author: 'Arthur C. Clarke',
    year: '1973',
    source: 'Profiles of the Future',
  },
  {
    id: 'saint-exupery-ship',
    text: "If you want to build a ship, don't drum up people to gather wood, divide the work and give orders. Instead, teach them to yearn for the vast and endless sea.",
    author: 'Antoine de Saint-Exupéry',
    year: '1948',
    source: 'Citadelle',
  },
  {
    id: 'einstein-imagination',
    text: 'Imagination is more important than knowledge.',
    author: 'Albert Einstein',
    year: '1929',
    source: 'Interview, The Saturday Evening Post',
  },
];
