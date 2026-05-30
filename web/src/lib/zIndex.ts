// Z-index layer map — all values are scoped to the board-container (isolation: isolate).
// Fan cards (0..N) and pile cards (0..3) are intentionally below every named layer.
export const Z = {
  UI_CHROME:   10,  // turn-line SVG, deal lightning, action badges
  FLY_AIR:     50,  // any card mid-air, including drawn card at decision zone
  DECISION:    60,  // Play / Draw decision buttons (above the hovering drawn card)
  COLOR_DIM:   70,  // dark scrim behind color picker
  MODAL:       80,  // color picker, game-over overlay
  DRAG_DESK:   90,  // desk lifted while a card is being dragged
  DRAG_PARENT: 95,  // hand-fan parent lifted while dragging (creates stacking ctx)
  DRAG_CARD:  200,  // card within its drag-parent stacking context
  DEBUG:      999,
} as const;
