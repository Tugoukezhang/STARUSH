// Three independently drawn expressions share one sheet per companion. The canvas also
// provides the alpha hit target, so transparent hair gaps stay outside the character.
const topics = ['greeting', 'rehearsal', 'encore'];

export function mountCompanionReaction(view, button, memberId) {
  const canvas = view.element('canvas', 'pm-cast-reaction', undefined, button);
  canvas.width = canvas.height = 512;
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const sheet = view.doc.createElement('img');
  let topic = null;
  const paint = () => {
    if (!topic || view.disposed || sheet.naturalWidth !== 1536 || sheet.naturalHeight !== 512) return;
    const ctx = canvas.getContext?.('2d', {willReadFrequently:true});
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(sheet, topics.indexOf(topic) * 512, 0, 512, 512, 0, 0, 512, 512);
    canvas.hidden = false;
    button.dataset.conversationPose = topic;
  };
  sheet.addEventListener('load', paint, {once:true});
  sheet.src = 'art/cast-encounters-20261125/' + memberId + '-dialogue.webp';
  return {
    show(area) {
      topic = topics.includes(area) ? area : null;
      if (topic) paint(); else this.clear();
    },
    clear() {
      topic = null;
      canvas.hidden = true;
      delete button.dataset.conversationPose;
    },
    hitTest(x, y) {
      if (canvas.hidden) return undefined;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const u = (x - rect.left) / rect.width, v = (y - rect.top) / rect.height;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
      const ctx = canvas.getContext('2d');
      return ctx.getImageData(Math.floor(u*512), Math.floor(v*512), 1, 1).data[3] < 24 ? null : v < .5 ? 'head' : 'body';
    },
  };
}
