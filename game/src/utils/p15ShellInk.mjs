/**
 * P15-312 approved public-shell ink set.
 *
 * The Production Desk, Tour Route and Idol Roster were coloured against the #0a0a1a
 * background, then P15-20 / P15-42 / P15-55 delivered cream runtime-candidate card art
 * and the same pale text started being drawn on top of it. P15-311 measured every string
 * drawn on a light card: nine of nine failed, the worst at 1.04 : 1.
 *
 * These three values are the only text colours allowed on a light card. They were chosen
 * to clear 4.5 : 1 against all three card tints with margin, so the set survives a card
 * re-tint of roughly +/- 10% value without another audit:
 *
 *   ink            desk #EDE7DD   tour #DDD7CD   row #E8E1D7
 *   INK_PRIMARY      12.1 : 1       10.4 : 1      11.5 : 1
 *   INK_SECONDARY    10.1 : 1        8.4 : 1       9.3 : 1
 *   INK_ACCENT       10.1 : 1        8.5 : 1       9.3 : 1
 *
 * P15-315: the secondary and accent inks carry deliberate headroom. P15-314 measured
 * rendered pixels rather than declared values and found 11px and 13px CJK anti-aliasing
 * to as much as 2.5x the nominal luminance, which put the original #55506B and #8C2F5A
 * at 2.75 - 4.27 : 1 on screen despite passing on paper. A floor is met on rendered
 * pixels or it is not met; these values are chosen so even a 2.5x lift clears 4.5 : 1.
 *
 * Text drawn on the dark background is deliberately NOT part of this set. It was measured
 * and it passes; changing it would be taste rather than a defect fix.
 */

export const P15_312_INK_PRIMARY = '#2B2438';
export const P15_312_INK_SECONDARY = '#3A3348';
export const P15_312_INK_ACCENT = '#5F1E3C';

/** Numeric form of INK_PRIMARY, for Phaser Graphics fills. */
export const P15_312_INK_PRIMARY_HEX = 0x2B2438;

/**
 * P15-312 D-02: the Tour Route venue card starts at x = 32 and its dark spine occupies
 * x 32..60.5, measured from the built output. Text was placed at x = 52 and ran under it.
 */
export const P15_312_VENUE_TEXT_X = 66;
