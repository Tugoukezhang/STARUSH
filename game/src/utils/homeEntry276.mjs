const RETURN_SEGMENT = 'fromHome=1';

// Pure so it can be tested without Phaser. Raw segments are kept because URLSearchParams.toString()
// would rewrite the other params. cleanedSearch is null when the URL must not be touched.
export function resolveTitleEntry(data, search) {
  const segments = String(search || '').replace(/^\?/, '').split('&');
  const rest = segments.filter(segment => segment !== RETURN_SEGMENT);
  const isReturn = segments.length - rest.length === 1
    && !rest.some(segment => segment === 'fromHome' || segment.startsWith('fromHome='));
  const explicit = Boolean(data?.openPage) || data?.openPreparation !== undefined;
  return {
    page: data?.openPage || (data?.openPreparation === true ? 'workshop' : isReturn && !explicit ? 'lounge' : 'desk'),
    cleanedSearch: isReturn ? (rest.length ? `?${rest.join('&')}` : '') : null,
  };
}
