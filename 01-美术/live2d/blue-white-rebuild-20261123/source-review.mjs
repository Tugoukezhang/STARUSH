const $ = selector => document.querySelector(selector);
const stage = $('#stage');
const selected = $('#selected');
const list = $('#list');
const status = $('#status');
const dx = $('#dx');
const dy = $('#dy');
const svgNS = 'http://www.w3.org/2000/svg';
const objectURLs = [];
const bitmaps = new Map();
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
async function readBytes(file) {
  const response = await fetch(file, {cache: 'no-store'});
  if (!response.ok) throw new Error(`${file}：HTTP ${response.status}`);
  return response.arrayBuffer();
}
function setEnabled(enabled) {
  for (const control of document.querySelectorAll('button, select, input')) control.disabled = !enabled;
}
setEnabled(false);
window.q86Ready = false;
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  bitmaps.forEach(bitmap => bitmap.close());
  objectURLs.length = 0; bitmaps.clear();
});
try {
  const [manifestBytes, rasterBytes, svgBytes] = await Promise.all(['layers.json', 'raster-layers.json', 'blue-white-layer-source.svg'].map(readBytes));
  const decode = bytes => new TextDecoder().decode(bytes);
  const manifest = JSON.parse(decode(manifestBytes));
  const raster = JSON.parse(decode(rasterBytes));
  if (await digest(manifestBytes) !== raster.manifestSha256 || await digest(svgBytes) !== raster.sourceSvgSha256) {
    throw new Error('PNG导出已过期：源稿与导出清单不一致，请重新导出。');
  }
  const layers = manifest.layers;
  const ids = new Set(layers.map(layer => layer.id));
  if (ids.size !== layers.length || raster.layers.length !== layers.length) throw new Error('导出图层数量或ID不一致。');
  for (let index = 0; index < layers.length; index++) {
    const source = layers[index], layer = raster.layers[index];
    if (source.id !== layer.id || (source.visible !== false) !== layer.visible ||
        ![layer.x, layer.y, layer.width, layer.height].every(Number.isInteger) ||
        layer.width <= 0 || layer.height <= 0 || layer.x < 0 || layer.y < 0 ||
        layer.x + layer.width > manifest.canvas.width || layer.y + layer.height > manifest.canvas.height) throw new Error(`图层元数据不一致：${source.id}`);
  }
  const images = new Map();
  // Decode only verified bytes. Four workers bound memory and avoid a second unchecked fetch.
  let next = 0;
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < raster.layers.length) {
      const layer = raster.layers[next++];
      const bytes = await readBytes(layer.file);
      if (await digest(bytes) !== layer.sha256) throw new Error(`PNG校验失败：${layer.id}`);
      const blob = new Blob([bytes], {type: 'image/png'});
      const bitmap = await createImageBitmap(blob);
      const correctSize = bitmap.width === layer.width && bitmap.height === layer.height;
      if (!correctSize) {bitmap.close(); throw new Error(`PNG尺寸不一致：${layer.id}`);}
      bitmaps.set(layer.id, bitmap);
      const url = URL.createObjectURL(blob);
      objectURLs.push(url);
      images.set(layer.id, url);
    }
  }));
  let svg;
  let composite;
  let mode = 'raster';
  let showingReference = false;
  const initial = new Map(layers.map(layer => [layer.id, layer.visible !== false]));
  const visible = new Map(initial);
  const shifts = new Map();
  // Owner grouping is an inspection aid, never a deformation or runtime binding.
  const ownedIds = id => [id, ...layers.filter(layer => layer.controlOwner === id).map(layer => layer.id)];
  function refresh() {
    const shift = shifts.get(selected.value) || [0, 0];
    dx.value = shift[0]; dy.value = shift[1];
    status.textContent = `${selected.value} / ${shift.join(', ')} px；含归属边缘，共${ownedIds(selected.value).length}层；平移仅检查遮挡，不代表绑定`;
  }
  function applyState() {
    for (const layer of layers) {
      const group = svg.getElementById(layer.id);
      group.style.display = visible.get(layer.id) ? '' : 'none';
      const shift = shifts.get(layer.id);
      if (shift) group.setAttribute('transform', `translate(${shift})`);
      else group.removeAttribute('transform');
      list.querySelector(`[data-layer="${layer.id}"]`).checked = visible.get(layer.id);
    }
    if (mode === 'raster') {
      const context = composite.getContext('2d');
      context.clearRect(0, 0, composite.width, composite.height);
      // Composite at source resolution BEFORE scaling the viewport. Scaling each
      // complementary alpha mask first creates false dark seams at shared edges.
      for (const layer of raster.layers) {
        if (!visible.get(layer.id)) continue;
        const [x, y] = shifts.get(layer.id) || [0, 0];
        context.drawImage(bitmaps.get(layer.id), layer.x + x, layer.y + y);
      }
    }
    svg.style.visibility = showingReference ? 'hidden' : '';
    refresh();
  }
  function render() {
    const viewBox = svg?.getAttribute('viewBox') || `0 0 ${manifest.canvas.width} ${manifest.canvas.height}`;
    if (mode === 'svg') {
      const doc = new DOMParser().parseFromString(decode(svgBytes), 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('SVG诊断源无法解析。');
      svg = document.importNode(doc.documentElement, true);
    } else {
      svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', manifest.canvas.width);
      svg.setAttribute('height', manifest.canvas.height);
      for (const layer of raster.layers) {
        const group = document.createElementNS(svgNS, 'g');
        group.id = layer.id;
        group.setAttribute('visibility', 'hidden');
        const image = document.createElementNS(svgNS, 'image');
        image.setAttribute('href', images.get(layer.id));
        for (const attr of ['x', 'y', 'width', 'height']) image.setAttribute(attr, layer[attr]);
        group.append(image); svg.append(group);
      }
      const viewport = document.createElementNS(svgNS, 'foreignObject');
      viewport.setAttribute('width', manifest.canvas.width);
      viewport.setAttribute('height', manifest.canvas.height);
      composite = document.createElement('canvas');
      composite.width = manifest.canvas.width;
      composite.height = manifest.canvas.height;
      composite.style.display = 'block';
      composite.setAttribute('aria-label', '已校验PNG在源尺寸合成的当前图层视图');
      viewport.append(composite); svg.append(viewport);
    }
    svg.setAttribute('viewBox', viewBox);
    stage.querySelector('svg')?.remove();
    stage.prepend(svg);
    stage.dataset.renderer = mode;
    $('#renderer-label').textContent = mode === 'raster' ? '实际PNG导出层（先按源尺寸合成，再缩放显示）' : 'SVG诊断（缩放时重新栅格化，不能代替导出验收）';
    $('#renderer').textContent = mode === 'raster' ? '查看SVG诊断' : '返回实际PNG层';
    applyState();
  }
  for (const layer of [...layers].reverse()) {
    const option = document.createElement('option'); option.value = layer.id; option.textContent = layer.label; selected.append(option);
    const row = document.createElement('div'); row.className = 'row';
    const label = document.createElement('label'); const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.dataset.layer = layer.id;
    label.append(checkbox, document.createTextNode(layer.label));
    const solo = document.createElement('button'); solo.textContent = '单层'; solo.dataset.solo = layer.id;
    solo.onclick = () => {const owned = ownedIds(layer.id); for (const id of ids) visible.set(id, owned.includes(id)); selected.value = layer.id; applyState();};
    checkbox.onchange = () => {for (const id of ownedIds(layer.id)) visible.set(id, checkbox.checked); applyState();};
    row.append(label, solo); list.append(row);
  }
  selected.onchange = refresh;
  for (const slider of [dx, dy]) slider.oninput = () => {const shift = [+dx.value, +dy.value]; for (const id of ownedIds(selected.value)) shifts.set(id, shift); applyState();};
  $('#reset').onclick = () => {shifts.clear(); for (const [id, value] of initial) visible.set(id, value); showingReference = false; stage.querySelector('img')?.remove(); applyState();};
  $('#source').onclick = () => {showingReference = !showingReference; stage.querySelector('img')?.remove(); if (showingReference) {const image = document.createElement('img'); image.src = 'cutout-candidate.png'; image.alt = '用户正式PNG的透明衍生图'; stage.append(image);} applyState();};
  $('#bg').onchange = event => stage.style.background = event.target.value;
  $('#renderer').onclick = () => {mode = mode === 'raster' ? 'svg' : 'raster'; render();};
  $('#layer-count').textContent = layers.length;
  $('#acceptance').textContent = manifest.sourcePreparationAccepted ? '已通过Q86源拆层验收。' : '未通过源拆层验收。';
  render();
  setEnabled(true);
  window.q86SourceCheck = {renderer: 'verified-exported-png', composition: 'source-resolution-before-viewport-scaling', layerCount: layers.length, pngHashesVerified: images.size, manifestSha256: raster.manifestSha256, sourceSvgSha256: raster.sourceSvgSha256};
  window.q86Ready = true;
} catch (error) {
  stage.replaceChildren();
  const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = `源层加载失败：${error.message}`; stage.append(message);
  $('#acceptance').textContent = '未加载，不能验收。';
  window.q86Error = error.message;
  setEnabled(false);
}
