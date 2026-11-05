import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { P15_312_INK_ACCENT, P15_312_INK_PRIMARY, P15_312_INK_PRIMARY_HEX,
  P15_312_INK_SECONDARY, P15_312_VENUE_TEXT_X } from '../src/utils/p15ShellInk.mjs';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const css = postcss.parse(readFileSync(new URL('../src/styles/publicShell.css', import.meta.url), 'utf8'));
const declaration = (selector, property) => {
  let value;
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(property, decl => { value = decl.value; });
  });
  assert.ok(value, 'Missing shell style: ' + selector + ' / ' + property);
  return value;
};
const resolveColor = value => value.startsWith('var(')
  ? declaration('#public-shell', value.slice(4, -1)) : value;

// Retained legacy helper math protects exports still used outside the new DOM shell.
// These are declared-color tests, not a rendered-pixel contrast or placement audit.
const CARD_TINTS = {
  'production desk call sheet': [237, 231, 221],
  'tour route venue record': [221, 215, 205],
  'idol roster member row': [243, 245, 242],
  'idol roster selected row': [223, 234, 229],
  'idol roster hovered row': [226, 233, 229],
};

const MIN_CONTRAST = 4.5;

function channel(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toRgb(hex) {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16));
}

function contrast(hex, tint) {
  const a = luminance(toRgb(hex));
  const b = luminance(tint);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

{
  // Every approved ink must read on every card the project actually ships.
  for (const [inkName, ink] of Object.entries({
    P15_312_INK_PRIMARY,
    P15_312_INK_SECONDARY,
    P15_312_INK_ACCENT,
  })) {
    for (const [cardName, tint] of Object.entries(CARD_TINTS)) {
      const ratio = contrast(ink, tint);
      assert.ok(
        ratio >= MIN_CONTRAST,
        `${inkName} (${ink}) on the ${cardName} is ${ratio.toFixed(2)} : 1, below the ${MIN_CONTRAST} : 1 floor`
      );
    }
  }

  assert.equal(P15_312_INK_PRIMARY_HEX, 0x2B2438, 'the numeric ink must match the string ink');
  assert.equal(
    P15_312_INK_PRIMARY_HEX,
    parseInt(P15_312_INK_PRIMARY.replace('#', ''), 16),
    'the numeric and string forms of the primary ink must not drift apart'
  );
}

{
  // Multiply the existing bitmap ground by each runtime tint, not just its untinted sample.
  for (const [name, rgb] of Object.entries({ locked: [210, 212, 216], hovered: [241, 246, 243] })) {
    const ground = CARD_TINTS['tour route venue record'].map((channel, index) => channel * rgb[index] / 255);
    for (const ink of [P15_312_INK_PRIMARY, P15_312_INK_SECONDARY]) {
      assert.ok(contrast(ink, ground) >= MIN_CONTRAST, `Tour ${name} text must retain the contrast floor`);
    }
  }
}

{
  assert.equal(P15_312_VENUE_TEXT_X, 66, 'Legacy venue helper export remains compatible');
  const background = declaration('#public-shell', 'background');
  const primary = declaration('#public-shell', 'color');
  const muted = declaration('#public-shell', '--shell-muted');
  const check = (ink, ground, label) => assert.ok(
    contrast(resolveColor(ink), toRgb(resolveColor(ground))) >= MIN_CONTRAST, label);
  check(primary, background, 'Shared body text');
  check(muted, background, 'Shared secondary text');
  check(declaration('#public-shell .shell-primary', 'color'),
    declaration('#public-shell .shell-primary', 'background'), 'Start and confirm text');
  check(declaration('#public-shell .shell-navigation button', 'color'),
    declaration('.shell-navigation', 'background'), 'Inactive navigation');
  check(declaration('#public-shell .shell-navigation [aria-current=page]', 'color'),
    declaration('#public-shell .shell-navigation [aria-current=page]', 'background'), 'Active navigation');
  for (const state of ['', '[aria-pressed=true]']) {
    check(primary, declaration('#public-shell .shell-chapter-option' + state, 'background'), 'Chapter name ' + state);
    check(declaration('.shell-chapter-copy > span', 'color'),
      declaration('#public-shell .shell-chapter-option' + state, 'background'), 'Chapter subtitle ' + state);
  }
  check(declaration('#public-shell .shell-chapter-option:disabled', 'color'),
    declaration('#public-shell .shell-chapter-option:disabled', 'background'), 'Locked chapter title');
  check(declaration('#public-shell .shell-chapter-option:disabled .shell-chapter-copy small', 'color'),
    declaration('#public-shell .shell-chapter-option:disabled', 'background'), 'Locked chapter prerequisite');
}

{
  assert.equal(declaration('#public-shell', 'inset'), '0');
  assert.equal(declaration('#public-shell', 'flex-direction'), 'column');
  assert.equal(declaration('#public-shell *', 'min-width'), '0');
  assert.equal(declaration('.shell-content', 'overflow-y'), 'auto');
  assert.equal(declaration('.shell-content', 'touch-action'), 'pan-y');
  assert.equal(declaration('.shell-content', 'overscroll-behavior'), 'contain');
  assert.equal(declaration('.shell-navigation', 'flex'), 'none');
  assert.equal(declaration('.shell-header', 'flex'), 'none');
  for (const [selector, property] of [
    ['#public-shell .shell-primary', 'min-height'],
    ['#public-shell .shell-icon-button', 'height'],
    ['#public-shell .shell-icon-button', 'width'],
    ['#public-shell .shell-navigation button', 'min-height'],
  ]) assert.ok(parseFloat(declaration(selector, property)) >= 44, 'Touch target: ' + selector);
  assert.ok(parseFloat(declaration('.shell-main-map', 'height')) > 0);
  assert.ok(declaration('#public-shell button:focus-visible', 'outline'));
  const entryHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(entryHtml, /<link\s+rel="stylesheet"\s+href="\/src\/styles\/publicShell\.css"\s*\/>/,
    'Vite HTML entry must load the shared stylesheet');
  for (const filename of ['TitleScene', 'TourRouteScene', 'IdolRosterScene']) {
    const source = readFileSync(new URL('../src/scenes/' + filename + '.js', import.meta.url), 'utf8');
    assert.match(source, /new PublicShellView\(/);
    assert.doesNotMatch(source, /this\.add\.(text|image|graphics|rectangle)\(|p15ShellInk|addP15VenueRecordCard|addP15CallSheetCardFrame/);
  }
}

console.log('Public shell shared CSS structure and declared contrast; legacy helper ink/placement exports preserved.');
