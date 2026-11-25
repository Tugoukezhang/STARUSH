export function calculateGameViewport(viewport, gameWidth = 375, gameHeight = 667) {
  if (!viewport || typeof viewport !== 'object') return null;
  const { width, height, offsetLeft = 0, offsetTop = 0, safeArea = {} } = viewport;
  if (!safeArea || typeof safeArea !== 'object') return null;
  const { top = 0, right = 0, bottom = 0, left = 0 } = safeArea;
  if (![width, height, gameWidth, gameHeight].every((value) => Number.isFinite(value) && value > 0)
    || ![offsetLeft, offsetTop].every(Number.isFinite)
    || ![top, right, bottom, left].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }

  const availableWidth = width - left - right;
  const availableHeight = height - top - bottom;
  if (availableWidth <= 0 || availableHeight <= 0) return null;
  const scale = Math.min(availableWidth / gameWidth, availableHeight / gameHeight);
  const displayWidth = gameWidth * scale;
  const displayHeight = gameHeight * scale;
  return {
    scale,
    x: offsetLeft + left + (availableWidth - displayWidth) / 2,
    y: offsetTop + top + (availableHeight - displayHeight) / 2,
    width: displayWidth,
    height: displayHeight,
  };
}

export function needsPortraitProtection({ width, height, touch }) {
  return touch === true && Number.isFinite(width) && Number.isFinite(height)
    && height > 0 && height < 500 && width > height;
}

export function getPublicShellViewport(frame) {
  if(!frame || ![frame.scale,frame.width,frame.height].every(v=>Number.isFinite(v)&&v>0))return null;
  const visibleScale=Math.max(1,frame.scale);
  return {width:frame.width/visibleScale,height:frame.height/visibleScale,compensation:visibleScale/frame.scale};
}

// Menus occupy the real portrait viewport; battle overlays retain the fitted game plane above.
export function getMenuViewport(frame,viewport) {
  const area=viewport.safeArea,availableWidth=viewport.width-area.left-area.right,height=viewport.height-area.top-area.bottom;
  const width=Math.min(availableWidth,480),x=viewport.offsetLeft+area.left+(availableWidth-width)/2,y=viewport.offsetTop+area.top;
  return {width,height,left:(x-frame.x)/frame.scale,top:(y-frame.y)/frame.scale,compensation:1/frame.scale};
}

// Rotation interrupts play once; portrait return must not silently resume it.
export function bindMobileOrientation(game, host = window) {
  const container = host.document.getElementById('game-container');
  const banner = host.document.getElementById('portrait-protection');
  if (!banner || !container) return () => {};
  let active = false, disposed = false;
  const keepProtection = event => event.preventDefault();
  banner.addEventListener?.('cancel', keepProtection);
  let protectedSessions = new WeakSet();
  const protectNewBattles = () => {
    if (!active || disposed) return;
    for (const scene of game.scene.getScenes(true)) {
      const session = scene._sessionExperience;
      if (session?.battle === true && !protectedSessions.has(session)) {
        protectedSessions.add(session);
        session.interrupt();
      }
    }
  };
  const update = () => {
    if (disposed) return;
    const next = needsPortraitProtection({ width: host.innerWidth, height: host.innerHeight,
      touch: host.matchMedia?.('(pointer: coarse)').matches === true });
    if (next === active) return;
    active = next; banner.hidden = !active;
    protectedSessions = new WeakSet();
    if (active) {
      // A battle can finish loading after the resize has already been handled.
      game.events?.on?.('poststep', protectNewBattles);
      protectNewBattles();
      // Native menu sheets sit in the browser top layer, above any fixed overlay.
      banner.showModal?.();
      container.inert = true;
    } else {
      game.events?.off?.('poststep', protectNewBattles);
      container.inert = host.document.getElementById('game-loading')?.hidden === false;
      if (banner.open) banner.close();
    }
  };
  host.addEventListener('resize', update);
  host.addEventListener('orientationchange', update);
  update();
  return () => {
    if (disposed) return;
    disposed = true;
    game.events?.off?.('poststep', protectNewBattles);
    host.removeEventListener('resize', update);
    host.removeEventListener('orientationchange', update);
    banner.hidden = true;
    if (active) container.inert = host.document.getElementById('game-loading')?.hidden === false;
    banner.removeEventListener?.('cancel', keepProtection);
    if (banner.open) banner.close();
  };
}

// Bind once after Phaser boots, and dispose when the game is destroyed, not on scene changes.
export function bindGameViewport(game, host = window) {
  const container = host.document.getElementById('game-container');
  const safeAreaProbe = host.document.getElementById('viewport-safe-area');
  const visualViewport = host.visualViewport;
  const fit = () => {
    const style = safeAreaProbe ? host.getComputedStyle(safeAreaProbe) : null;
    const viewport = {
      width: visualViewport ? visualViewport.width : host.innerWidth,
      height: visualViewport ? visualViewport.height : host.innerHeight,
      offsetLeft: visualViewport?.offsetLeft ?? 0,
      offsetTop: visualViewport?.offsetTop ?? 0,
      safeArea: {
        top: parseFloat(style?.paddingTop) || 0,
        right: parseFloat(style?.paddingRight) || 0,
        bottom: parseFloat(style?.paddingBottom) || 0,
        left: parseFloat(style?.paddingLeft) || 0,
      },
    };
    const frame=calculateGameViewport(viewport,game.config.width,game.config.height);
    if (!frame) return;
    container.style.left = `${frame.x}px`;
    container.style.top = `${frame.y}px`;
    container.style.transform = `scale(${frame.scale})`;
    // Reflow menus in CSS pixels on small phones; Phaser still owns its one transform.
    const shell=getPublicShellViewport(frame);
    container.style.setProperty?.('--public-shell-width',`${shell.width}px`);
    container.style.setProperty?.('--public-shell-height',`${shell.height}px`);
    container.style.setProperty?.('--public-shell-compensation',String(shell.compensation));
    const menu=getMenuViewport(frame,viewport);
    for(const key of ['width','height','left','top'])container.style.setProperty?.('--menu-shell-'+key,menu[key]+'px');
    container.style.setProperty?.('--menu-shell-compensation',String(menu.compensation));
    container.style.setProperty?.('--menu-scene-top',`${(viewport.offsetTop-frame.y)/frame.scale}px`);
    container.style.setProperty?.('--menu-scene-height',`${viewport.height}px`);
    container.style.setProperty?.('--menu-safe-bottom',`${viewport.safeArea.bottom}px`);
    // NONE keeps logical dimensions; refresh reads the transformed bounds for Phaser input.
    game.scale.refresh();
  };

  const listeners = [
    [host, 'resize'],
    [host, 'orientationchange'],
    [host, 'pageshow'],
    [visualViewport, 'resize'],
    [visualViewport, 'scroll'],
  ].filter(([target]) => target);
  fit();
  listeners.forEach(([target, event]) => target.addEventListener(event, fit));
  return () => listeners.forEach(([target, event]) => target.removeEventListener(event, fit));
}
