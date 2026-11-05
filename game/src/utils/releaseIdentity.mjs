// Bump rules when public outcome comparisons cease to be meaningful across builds.
export const PUBLIC_RULESET_ID = 'owner-three-chapter-v17';
export const PUBLIC_RULESET_LABEL = '三人巡演 · 规则 17';
export const PUBLIC_BUILD_ID = typeof __STARUSH_BUILD_ID__ === 'string' ? __STARUSH_BUILD_ID__ : 'source-preview';
export const validRulesetId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
