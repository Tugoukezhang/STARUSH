const rowsByMesh = new WeakMap();
const epsilon = 1e-8;

function crossSections(mesh) {
  if (rowsByMesh.has(mesh)) return rowsByMesh.get(mesh);
  const byV = new Map(), rows = [];
  if (!mesh.uv || mesh.uv.length !== mesh.vertices.length) return rows;
  mesh.uv.forEach(([, v], i) => {
    if (!byV.has(v)) byV.set(v, []);
    byV.get(v).push(i);
  });
  for (const indices of byV.values()) {
    if (indices.length < 3) continue;
    indices.sort((a, b) => mesh.uv[a][0] - mesh.uv[b][0]);
    const first = indices[0], last = indices.at(-1), weights = mesh.weights[first];
    const u0 = mesh.uv[first][0], du = mesh.uv[last][0] - u0;
    if (du <= epsilon || weights.length !== 2 || weights.some(([, w]) => w <= 0)
      || Math.abs(weights[0][1] + weights[1][1] - 1) > 1e-6) continue;
    const [x, y] = mesh.vertices[first];
    const dx = mesh.vertices[last][0] - x, dy = mesh.vertices[last][1] - y;
    const factors = indices.map(i => (mesh.uv[i][0] - u0) / du);
    const uniform = indices.every((i, j) => mesh.weights[i].length === 2
      && mesh.weights[i].every(([bone, w], k) => bone === weights[k][0] && Math.abs(w - weights[k][1]) < epsilon)
      && Math.hypot(mesh.vertices[i][0] - x - factors[j] * dx, mesh.vertices[i][1] - y - factors[j] * dy) < 2e-5
      && (!mesh.fold?.[i] || mesh.fold[i].every(v => v === 0)));
    if (uniform && Math.hypot(dx, dy) > epsilon) rows.push({indices, factors, weights, dx, dy});
  }
  rowsByMesh.set(mesh, rows);
  return rows;
}

function isArmJoint(rig, weights) {
  const a = rig.bones[weights[0][0]], b = rig.bones[weights[1][0]];
  const child = a?.parent === weights[1][0] ? a : b?.parent === weights[0][0] ? b : null;
  if (!child) return false;
  const parent = rig.bones[child.parent];
  return (parent.name === 'chest' && /^upper\.[RL]$/.test(child.name))
    || (/^upper\.[RL]$/.test(parent.name) && child.name === parent.name.replace('upper', 'forearm'))
    || (parent.name === 'forearm.R' && child.name === 'fan');
}

export function preserveSakuraArmVolume(rig, mesh, positions, transforms) {
  if (mesh.name !== 'arm.R' && mesh.name !== 'arm.L') return positions;
  let result = positions;
  for (const row of crossSections(mesh)) {
    if (!isArmJoint(rig, row.weights) || !row.indices.every(i => mesh.weights[i].length === 2
      && mesh.weights[i].every(([bone, w], k) => bone === row.weights[k][0] && Math.abs(w - row.weights[k][1]) < epsilon))) continue;
    const first = row.indices[0], last = row.indices.at(-1);
    const span = row.weights.map(([bone, weight]) => {
      const m = transforms[bone];
      return {x: m[0] * row.dx + m[2] * row.dy, y: m[1] * row.dx + m[3] * row.dy, weight};
    });
    const width = span.reduce((sum, v) => sum + v.weight * Math.hypot(v.x, v.y), 0);
    const dx = positions[last][0] - positions[first][0], dy = positions[last][1] - positions[first][1];
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(width) || !Number.isFinite(length) || width - length <= epsilon) continue;
    const dominant = span[0].weight >= span[1].weight ? span[0] : span[1];
    const axis = length > epsilon ? {x: dx, y: dy} : dominant;
    const axisLength = Math.hypot(axis.x, axis.y);
    if (axisLength <= epsilon) continue;
    const correctionX = axis.x / axisLength * width - dx;
    const correctionY = axis.y / axisLength * width - dy;
    if (result === positions) result = positions.slice();
    // Expand only across the authored row, pinning its midpoint and rigid palm.
    row.indices.forEach((i, j) => {
      const offset = row.factors[j] - .5;
      result[i] = [positions[i][0] + offset * correctionX, positions[i][1] + offset * correctionY];
    });
  }
  return result;
}
