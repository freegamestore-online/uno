import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { Card } from '../components/Card';
import type { UnoCard } from '../lib/uno';

// Regression: the game was renamed from "UNO" (Mattel trade dress) to "Crazy Eights".
// Case-sensitive on purpose: "UNO" as a standalone word must never reach visible output.
const FORBIDDEN = /\bUNO\b/;

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const CARD_VALUES: UnoCard[] = [
  { id: 'n', color: 'red', value: '7' } as UnoCard,
  { id: 's', color: 'green', value: 'skip' } as UnoCard,
  { id: 'r', color: 'blue', value: 'reverse' } as UnoCard,
  { id: 'd', color: 'yellow', value: 'draw2' } as UnoCard,
  { id: 'w', color: 'wild', value: 'wild' } as UnoCard,
  { id: 'w4', color: 'wild', value: 'wild4' } as UnoCard,
];

afterEach(() => cleanup());

describe('branding: no "UNO" in visible output', () => {
  it('menu screen renders without "UNO"', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('Crazy Eights');
    expect(container.textContent).toContain('vs Computer');
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('setup screen renders without "UNO"', async () => {
    const { container, getByText, findByText } = render(<App />);
    const vsComputer = getByText('vs Computer').closest('button');
    expect(vsComputer).not.toBeNull();
    fireEvent.click(vsComputer!);
    await findByText('Choose your opponents');
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('card faces and card backs render without "UNO"', () => {
    const { container } = render(
      <>
        {CARD_VALUES.map(card => <Card key={card.id} card={card} />)}
        <Card card={CARD_VALUES[0]!} faceDown />
      </>,
    );
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('document title and web manifest name are "Crazy Eights"', () => {
    const html = read('../../index.html');
    const config = read('../../vite.config.ts');
    expect(html).toContain('<title>Crazy Eights');
    expect(config).toContain('name: "Crazy Eights"');
    expect(config).toContain('short_name: "Crazy Eights"');
    expect(html).not.toMatch(FORBIDDEN);
    expect(config).not.toMatch(FORBIDDEN);
  });
});
