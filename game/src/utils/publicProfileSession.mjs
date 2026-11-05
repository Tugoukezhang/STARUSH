export const PUBLIC_PROFILE_LOCK_NAME = 'starush.public-profile.writer.v1';

// Hold one origin-wide writer for the game's lifetime, not a racy storage lease.
export function createPublicProfileSession({ locks, boot, beforeClose = () => {}, onState = () => {}, eventTarget, reload = () => {} }) {
  const abort = new AbortController();
  let started = false;
  let closed = false;
  let owner = false;
  let release;
  let stop;
  const close = () => {
    if (closed) return;
    // The last synchronous checkpoint still needs the writer lease.
    try {
      if (owner) beforeClose();
    } finally {
      closed = true;
      owner = false;
      abort.abort();
      try { stop?.(); } finally { release?.(); }
    }
  };
  const fail = () => {
    if (closed) return;
    close();
    onState('failed');
  };
  return {
    isOwner: () => owner && !closed,
    dispose: close,
    start() {
      if (started || closed) return;
      started = true;
      eventTarget?.addEventListener('pagehide', close, { once: true });
      // A restored document must acquire again and load a fresh profile.
      eventTarget?.addEventListener('pageshow', event => { if (event.persisted) reload(); });
      if (typeof locks?.request !== 'function') {
        closed = true;
        onState('unsupported');
        return;
      }
      onState('waiting');
      try {
        Promise.resolve(locks.request(PUBLIC_PROFILE_LOCK_NAME, { mode: 'exclusive', signal: abort.signal }, async lock => {
          if (closed || !lock) return;
          const lifetime = new Promise(resolve => { release = resolve; });
          owner = true;
          try {
            onState('owned');
            stop = boot();
            await lifetime;
          } finally {
            owner = false;
          }
        })).catch(fail);
      } catch {
        fail();
      }
    },
  };
}
