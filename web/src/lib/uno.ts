export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
  chosenColor?: CardColor;
}

export type Difficulty = 'hard' | 'medium' | 'easy';
export type SeatPosition = 'top' | 'left' | 'right' | 'bottom';

export interface OpponentConfig {
  name: string;
  difficulty: Difficulty;
  position: SeatPosition;
}

export interface Player {
  id: number;
  name: string;
  hand: UnoCard[];
  isHuman: boolean;
  difficulty?: Difficulty;
  position: SeatPosition;
}

export type GamePhase = 'setup' | 'playing' | 'color-pick' | 'game-over';

export interface GameState {
  deck: UnoCard[];
  discard: UnoCard[];
  players: Player[];
  currentPlayer: number;
  direction: 1 | -1;
  phase: GamePhase;
  winner: number | null;
  pendingAction: {
    type: 'skip' | 'draw2' | 'wild4' | 'reverse' | 'wild';
    target: number;
    nextPlayer: number;
    color?: CardColor;
  } | null;
}

const COLORS: CardColor[] = ['red', 'green', 'blue', 'yellow'];
const ACTION_VALUES: CardValue[] = ['skip', 'reverse', 'draw2'];
const NUMBER_VALUES: CardValue[] = ['1','2','3','4','5','6','7','8','9'];

function makeId(color: CardColor, value: CardValue, n: number): string {
  return `${color}-${value}-${n}`;
}

export function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  for (const color of COLORS) {
    cards.push({ id: makeId(color, '0', 0), color, value: '0' });
    for (const value of [...NUMBER_VALUES, ...ACTION_VALUES]) {
      cards.push({ id: makeId(color, value, 0), color, value });
      cards.push({ id: makeId(color, value, 1), color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `wild-wild-${i}`, color: 'wild', value: 'wild' });
    cards.push({ id: `wild-wild4-${i}`, color: 'wild', value: 'wild4' });
  }
  return shuffle(cards);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

export function topCard(state: GameState): UnoCard {
  return state.discard[state.discard.length - 1] as UnoCard;
}

export function effectiveColor(card: UnoCard): CardColor {
  return card.chosenColor ?? card.color;
}

export function isPlayable(card: UnoCard, top: UnoCard): boolean {
  if (card.value === 'wild' || card.value === 'wild4') return true;
  const topColor = effectiveColor(top);
  return card.color === topColor || card.value === top.value;
}

export function initGame(opponents: OpponentConfig[]): GameState {
  let deck = buildDeck();

  const players: Player[] = [
    { id: 0, name: 'You', hand: [], isHuman: true, position: 'bottom' },
    ...opponents.map((opp, i) => ({ id: i + 1, name: opp.name, hand: [], isHuman: false, difficulty: opp.difficulty, position: opp.position })),
  ];

  for (let round = 0; round < 7; round++) {
    for (const p of players) {
      const card = deck.pop();
      if (card) p.hand.push(card);
    }
  }

  let firstCard = deck.pop();
  while (!firstCard || firstCard.value === 'wild4') {
    if (firstCard) deck.unshift(firstCard);
    deck = shuffle(deck);
    firstCard = deck.pop();
  }

  return {
    deck,
    discard: [firstCard],
    players,
    currentPlayer: 0,
    direction: 1,
    phase: 'playing',
    winner: null,
    pendingAction: null,
  };
}

export function drawCards(state: GameState, playerId: number, count: number): GameState {
  let { deck, discard } = state;
  const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      const top = discard[discard.length - 1] as UnoCard;
      deck = shuffle(discard.slice(0, -1).map(c => ({ ...c, chosenColor: undefined })));
      discard = [top];
    }
    const card = deck.pop();
    if (card) players[playerId]?.hand.push(card);
  }

  return { ...state, deck, discard, players };
}

export function playCard(state: GameState, cardId: string, chosenColor?: CardColor): GameState {
  let s = { ...state, players: state.players.map(p => ({ ...p, hand: [...p.hand] })) };
  const playerIndex = s.currentPlayer;
  const player = s.players[playerIndex];
  if (!player) return state;

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;

  const baseCard = player.hand[cardIndex];
  if (!baseCard) return state;
  const card: UnoCard = { ...baseCard };
  if (card.color === 'wild') card.chosenColor = chosenColor;

  player.hand.splice(cardIndex, 1);
  s.discard = [...s.discard, card];

  if (player.hand.length === 0) {
    return { ...s, phase: 'game-over', winner: playerIndex };
  }

  const n = s.players.length;
  const advance = (from: number, skip = false): number => {
    const step = skip ? s.direction * 2 : s.direction;
    return ((from + step) % n + n) % n;
  };

  switch (card.value) {
    case 'skip': {
      const victim = advance(playerIndex);
      s.pendingAction = { type: 'skip', target: victim, nextPlayer: advance(playerIndex, true) };
      s.currentPlayer = victim;
      break;
    }
    case 'reverse': {
      s.direction = (s.direction * -1) as 1 | -1;
      const nextPlayer = n === 2 ? playerIndex : advance(playerIndex);
      s.pendingAction = { type: 'reverse', target: playerIndex, nextPlayer, color: card.color };
      s.currentPlayer = playerIndex;
      break;
    }
    case 'draw2': {
      const victim = advance(playerIndex);
      s.pendingAction = { type: 'draw2', target: victim, nextPlayer: advance(playerIndex, true) };
      s.currentPlayer = victim;
      break;
    }
    case 'wild4': {
      const victim = advance(playerIndex);
      s.pendingAction = { type: 'wild4', target: victim, nextPlayer: advance(playerIndex, true) };
      s.currentPlayer = victim;
      break;
    }
    case 'wild': {
      s.pendingAction = { type: 'wild', target: playerIndex, nextPlayer: advance(playerIndex), color: chosenColor };
      s.currentPlayer = playerIndex;
      break;
    }
    default:
      s.currentPlayer = advance(playerIndex);
  }

  return s;
}

export function cpuChooseCard(state: GameState): UnoCard | null {
  const top = topCard(state);
  const player = state.players[state.currentPlayer];
  if (!player) return null;
  const playable = player.hand.filter(c => isPlayable(c, top));
  if (playable.length === 0) return null;

  const diff = player.difficulty ?? 'hard';

  if (diff === 'easy') {
    if (Math.random() < 0.35) return null; // Gamma sometimes misses a play
    return playable[Math.floor(Math.random() * playable.length)] ?? null;
  }

  if (diff === 'medium') {
    return playable[Math.floor(Math.random() * playable.length)] ?? null;
  }

  // hard: priority order
  const priority: CardValue[] = ['wild4', 'wild', 'draw2', 'skip', 'reverse'];
  for (const val of priority) {
    const found = playable.find(c => c.value === val);
    if (found) return found;
  }
  return playable[0] ?? null;
}

export function cpuChooseColor(hand: UnoCard[]): CardColor {
  const counts: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
  for (const c of hand) {
    if (c.color !== 'wild') counts[c.color] = (counts[c.color] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] as CardColor) ?? 'red';
}
