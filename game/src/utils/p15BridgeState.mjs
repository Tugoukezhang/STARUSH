export const P15_STAGE1_CLEAR_COUNT_KEY = 'starush.p15.stage1ClearCount';

export function normalizeP15Stage1ClearCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

export function readP15Stage1ClearCount(storage = globalThis?.sessionStorage) {
  try {
    return normalizeP15Stage1ClearCount(storage?.getItem?.(P15_STAGE1_CLEAR_COUNT_KEY));
  } catch {
    return 0;
  }
}

export function writeP15Stage1ClearCount(count, storage = globalThis?.sessionStorage) {
  const normalized = normalizeP15Stage1ClearCount(count);
  try {
    storage?.setItem?.(P15_STAGE1_CLEAR_COUNT_KEY, String(normalized));
  } catch {
    // Session state is a soft retention hint; gameplay must continue if storage is unavailable.
  }
  return normalized;
}
