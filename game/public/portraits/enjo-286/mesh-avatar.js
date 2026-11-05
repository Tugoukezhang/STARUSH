/*! fflate
MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
function qe(e, t) {
  const n = [0];
  for (let i = 1; i < e.length; i++) n.push(n.at(-1) + Math.hypot(e[i][0] - e[i - 1][0], e[i][1] - e[i - 1][1]));
  const r = Math.max(0, Math.min(1, t)) * n.at(-1);
  let o = 1;
  for (; o < e.length - 1 && n[o] < r; ) o++;
  const s = (r - n[o - 1]) / Math.max(1e-9, n[o] - n[o - 1]);
  return e[o - 1].map((i, u) => i + (e[o][u] - i) * s);
}
const Pt = (e) => e.slice(1).reduce((t, n, r) => t + Math.hypot(n[0] - e[r][0], n[1] - e[r][1]), 0);
function qn(e, t) {
  let n = 0;
  const r = Pt(e), o = [];
  for (let i = 1; i < e.length; i++) {
    const u = e[i - 1], y = e[i], v = y[0] - u[0], m = y[1] - u[1], l = Math.hypot(v, m);
    for (let c = 1; c < t.length; c++) {
      const f = t[c - 1], h = t[c], p = h[0] - f[0], g = h[1] - f[1], b = v * g - m * p;
      if (Math.abs(b) < 1e-9) continue;
      const a = ((f[0] - u[0]) * g - (f[1] - u[1]) * p) / b, d = ((f[0] - u[0]) * m - (f[1] - u[1]) * v) / b;
      a >= -1e-8 && a <= 1 + 1e-8 && d >= -1e-8 && d <= 1 + 1e-8 && o.push((n + a * l) / r);
    }
    n += l;
  }
  const s = o.filter((i, u) => o.findIndex((y) => Math.abs(i - y) < 1e-7) === u);
  if (s.length !== 1) throw new RangeError("Each tier must cross every column exactly once");
  return s[0];
}
function kn(e) {
  const t = !!(e.seams?.length || e.tiers?.length), n = e.seams?.length || (e.columns ?? 8), r = e.seams?.length ? e.seams : Array.from({ length: n }, (m, l) => [qe(e.waist, l / (n - 1)), qe(e.hem, l / (n - 1))]);
  if (t && r.some((m) => Pt(m) < 1)) throw new RangeError("Columns must have nonzero source length");
  const o = r.map((m) => [0, ...e.tiers?.length ? e.tiers.map((l) => qn(m, l)) : [0.5], 1]);
  for (const m of o) if (m.some((l, c) => c > 0 && l - m[c - 1] < 1e-3)) throw new RangeError("Tier intersections must be ordered from waist to hem, with nonzero links");
  const s = o[0].length - 1, i = t ? Math.max(2, Math.ceil(((e.rows ?? 5) - 1) / s)) : 0, u = t ? s * i + 1 : e.rows ?? 5, y = new Float64Array(u * n * 2), v = [];
  for (let m = 0; m < n; m++) {
    v[m] = [];
    for (let l = 0; l < u; l++) {
      const c = t ? Math.min(s - 1, Math.floor(l / i)) : 0, f = t ? (l - c * i) / i : l / (u - 1), h = t ? o[m][c] + (o[m][c + 1] - o[m][c]) * f : f;
      v[m].push(h), y.set(qe(r[m], h), (l * n + m) * 2);
    }
  }
  if (t) for (let m = 0; m < u - 1; m++) for (let l = 0; l < n - 1; l++) {
    const c = (m * n + l) * 2, f = c + 2, h = c + n * 2, p = h + 2, g = (b, a, d) => (y[a] - y[b]) * (y[d + 1] - y[b + 1]) - (y[a + 1] - y[b + 1]) * (y[d] - y[b]);
    if (g(c, f, p) <= 1e-6 || g(c, p, h) <= 1e-6) throw new RangeError("Columns must be ordered left to right without crossing");
  }
  return { custom: t, cols: n, rows: u, rest: y, seams: r, joints: o, fractions: v, lengths: r.map(Pt), top: r.map((m) => m[0]) };
}
const le = (e, t, n) => {
  (typeof e != "number" || !Number.isFinite(e)) && n.push(`${t}: expected a finite number`);
}, we = (e, t, n) => {
  le(e, t, n), typeof e == "number" && e <= 0 && n.push(`${t}: must be positive`);
}, De = (e, t, n) => {
  le(e, t, n), typeof e == "number" && e < 0 && n.push(`${t}: must be nonnegative`);
}, Jn = (e, t, n) => {
  De(e, t, n), typeof e == "number" && (!Number.isInteger(e) || e > 8) && n.push(`${t}: expected an integer from 0 to 8`);
}, _e = (e, t, n) => {
  we(e, t, n), typeof e == "number" && !Number.isInteger(e) && n.push(`${t}: expected an integer`);
}, ot = (e, t, n) => {
  le(e, t, n), typeof e == "number" && !Number.isInteger(e) && n.push(`${t}: expected an integer`);
}, yt = (e, t, n) => {
  (typeof e != "string" || !e.trim()) && n.push(`${t}: expected a non-empty string`);
}, Oe = (e, t = 0, n = 1 / 0) => (r, o, s) => {
  if (!Array.isArray(r)) {
    s.push(`${o}: expected an array`);
    return;
  }
  (r.length < t || r.length > n) && s.push(`${o}: expected ${t}..${n} items`), r.forEach((i, u) => e(i, `${o}[${u}]`, s));
}, me = Oe(le, 2, 2), Ae = (e, t, n) => {
  me(e, t, n), Array.isArray(e) && e.length === 2 && e[0] >= e[1] && n.push(`${t}: start must be less than end`);
}, he = (e, t = []) => (n, r, o) => {
  if (!n || typeof n != "object" || Array.isArray(n)) {
    o.push(`${r}: expected an object`);
    return;
  }
  const s = n;
  for (const [i, u] of Object.entries(e))
    s[i] === void 0 && t.includes(i) || u(s[i], `${r}.${i}`, o);
}, ft = { cx: le, cy: le, rx: we, ry: we }, Ue = he(ft), st = Oe(me, 3), Xe = Oe(me, 2), Je = (e, t, n) => {
  le(e, t, n), typeof e == "number" && (e < 0 || e > 1) && n.push(`${t}: must be between 0 and 1`);
}, Kn = (e) => he({
  version: (t, n, r) => {
    t !== 1 && r.push(`${n}: only version 1 is supported`);
  },
  image: he({ width: _e, height: _e }),
  head: he({
    ...ft,
    shiftX: le,
    shiftY: le,
    pivotX: le,
    pivotY: le,
    maxRoll: le,
    weightBand: Ae,
    turnBand: Ae
  }),
  body: he({
    pivotX: le,
    pivotY: le,
    maxRoll: le,
    breathBand: Ae,
    rollBand: Ae,
    chest: Ue,
    shoulders: Oe(Ue),
    hip: he({ shift: le, band: Ae })
  }, ["hip"]),
  face: he({
    nose: Ue,
    mouth: Ue,
    eyeA: Ue,
    eyeB: Ue,
    earL: Ue,
    earR: Ue,
    brow: he({ ...ft, band: Ae }),
    jaw: he({ ...ft, band: Ae })
  }),
  buns: he({ bunL: Ue, bunR: Ue }, ["bunL", "bunR"]),
  eyes: Oe(he({
    opening: st,
    roi: st,
    x0: le,
    x1: le,
    top: Oe(le, 24, 24),
    bot: Oe(le, 24, 24)
  }, e ? ["x0", "x1", "top", "bot"] : []), 2, 2),
  mouth: he({
    cx: le,
    cy: le,
    angle: le,
    halfLen: we,
    bow: le,
    area: he({ ...ft, angle: le })
  }),
  cheeks: Oe(me, 2, 2),
  strands: Oe(he({ name: yt, nodes: Xe, sigma: we, k: we, max: we })),
  accessories: Oe(he({
    name: yt,
    pivot: me,
    tip: me,
    split: Je,
    box: Oe(ot, 4, 4),
    color: he({ redness: Je, minRed: le })
  })),
  hand: he({
    outline: st,
    jaw: Xe,
    jawRange: Ae,
    background: st,
    elbow: me,
    wrist: me,
    knuckle: me,
    contact: me,
    forearmShare: Je,
    armBand: Ae,
    wristBand: Ae,
    handBand: Ae,
    fingerXBand: Ae,
    fingerYBand: Ae,
    pinBand: Ae
  }),
  cloth: Oe(he({
    name: yt,
    outline: st,
    waist: Xe,
    hem: Xe,
    columns: _e,
    rows: _e,
    stiffness: we,
    damping: we,
    max: we,
    tierGain: we,
    highModeDamping: we,
    responseGain: we,
    swing: we,
    follow: Je,
    cohesion: Jn,
    wind: De,
    behind: (t, n, r) => {
      typeof t != "boolean" && r.push(`${n}: expected a boolean`);
    },
    parent: yt,
    scale: we,
    seams: Oe(Xe, 0, 64),
    tiers: Oe(Xe, 0, 8)
  }, ["tierGain", "highModeDamping", "seams", "tiers", "responseGain", "columns", "rows", "stiffness", "damping", "max", "swing", "follow", "cohesion", "wind", "behind", "parent", "scale"])),
  legs: he({
    spine: Je,
    bob: De,
    twist: De,
    pelvis: me,
    shift: De,
    tilt: De,
    bend: De,
    band: Ae,
    split: Xe,
    left: he({ hip: me, knee: me, ankle: me }),
    right: he({ hip: me, knee: me, ankle: me })
  }, ["spine", "bob", "twist"]),
  arms: he({
    swing: De,
    bend: De,
    inward: Je,
    left: he({ shoulder: me, elbow: me, wrist: me, split: Xe }),
    right: he({ shoulder: me, elbow: me, wrist: me, split: Xe })
  }, ["swing", "bend", "inward"]),
  mesh: he({
    baseCell: _e,
    fine: he({
      x0: ot,
      x1: ot,
      y0: ot,
      y1: ot,
      cell: _e
    }),
    handCell: _e,
    tasselCell: _e,
    eyeBallCell: _e,
    eyeCell: _e,
    spriteCell: _e,
    clothCell: _e
  }, ["clothCell"]),
  view: he({ padTop: le, padSide: le, gazeCenter: me, irisTravel: we }, ["gazeCenter", "irisTravel"])
}, ["buns", "strands", "accessories", "hand", "cloth", "legs", "arms"]);
function Ln(e, t = {}) {
  const n = [];
  if (Kn(t.draft ?? !1)(e, "rig", n), n.length) return n;
  const r = e;
  r.eyes.forEach((s, i) => {
    const u = ["x0", "x1", "top", "bot"];
    if (!(t.draft && u.every((y) => s[y] === void 0))) {
      if (u.some((y) => s[y] === void 0)) {
        n.push(`rig.eyes[${i}]: supply all x0/x1/top/bot fields or omit all in a draft`);
        return;
      }
      s.x0 >= s.x1 && n.push(`rig.eyes[${i}].x1: must exceed x0`), s.top.some((y, v) => y > s.bot[v]) && n.push(`rig.eyes[${i}].top: must not exceed bottom curve`);
    }
  }), (r.mesh.fine.x0 >= r.mesh.fine.x1 || r.mesh.fine.y0 >= r.mesh.fine.y1) && n.push("rig.mesh.fine: rectangle must have positive area"), (r.view.padTop <= -1 || r.view.padTop >= 1 || r.view.padSide <= -0.5) && n.push("rig.view: margins must leave a positive viewport");
  for (const [s, i] of (r.strands ?? []).entries())
    i.nodes.some((u, y) => y > 0 && u[0] === i.nodes[y - 1][0] && u[1] === i.nodes[y - 1][1]) && n.push(`rig.strands[${s}].nodes: consecutive nodes must differ`);
  for (const [s, i] of (r.accessories ?? []).entries())
    (i.box[0] < 0 || i.box[1] < 0 || i.box[2] > r.image.width || i.box[3] > r.image.height) && n.push(`rig.accessories[${s}].box: rectangle must stay inside the image`), (i.split <= 0 || i.split >= 1) && n.push(`rig.accessories[${s}].split: must be strictly between 0 and 1`), i.pivot.every((u, y) => u === i.tip[y]) && n.push(`rig.accessories[${s}].tip: must differ from pivot`), (i.box[0] >= i.box[2] || i.box[1] >= i.box[3]) && n.push(`rig.accessories[${s}].box: rectangle must have positive area`);
  const o = /* @__PURE__ */ new Set();
  if (r.legs) {
    (r.legs.twist ?? 0) > 15 && n.push("rig.legs.twist: must be between 0 and 15 degrees");
    const s = r.legs;
    for (const i of ["left", "right"]) {
      const u = s[i];
      s.band[0] < u.hip[1] && u.hip[1] < u.knee[1] && u.knee[1] < u.ankle[1] || n.push(`rig.legs.${i}: require band start < hip y < knee y < ankle y`);
    }
    s.split.some((i, u) => u > 0 && i[1] <= s.split[u - 1][1]) && n.push("rig.legs.split: y coordinates must increase");
  }
  if (r.arms) {
    (r.arms.swing ?? 4) > 10 && n.push("rig.arms.swing: must be between 0 and 10 degrees"), (r.arms.bend ?? 6) > 12 && n.push("rig.arms.bend: must be between 0 and 12 degrees");
    for (const s of ["left", "right"]) {
      const i = r.arms[s], u = `rig.arms.${s}`;
      i.shoulder[1] < i.elbow[1] && i.elbow[1] < i.wrist[1] || n.push(`${u}: require shoulder y < elbow y < wrist y`);
      for (const [y, v] of Object.entries({ shoulder: [i.shoulder], elbow: [i.elbow], wrist: [i.wrist], split: i.split }))
        v.some(([m, l]) => m < 0 || l < 0 || m >= r.image.width || l >= r.image.height) && n.push(`${u}.${y}: points must stay inside the image`);
      if (i.split.some((y, v) => v > 0 && y[1] <= i.split[v - 1][1]))
        n.push(`${u}.split: y coordinates must increase`);
      else {
        const y = (v) => {
          let m = 0;
          for (; m < i.split.length - 2 && v > i.split[m + 1][1]; ) m++;
          const l = i.split[m], c = i.split[m + 1], f = Math.max(0, Math.min(1, (v - l[1]) / (c[1] - l[1])));
          return l[0] + (c[0] - l[0]) * f;
        };
        [i.elbow, i.wrist].some(([v, m]) => s === "left" ? y(m) <= v : y(m) >= v) && n.push(`${u}.split: must lie on the body side of elbow and wrist`);
      }
    }
  }
  for (const [s, i] of (r.cloth ?? []).entries()) {
    if ((!/^[A-Za-z0-9_-]+$/.test(i.name) || o.has(i.name)) && n.push(`rig.cloth[${s}].name: must be a unique layer-safe name`), i.parent !== void 0 && !o.has(i.parent) && n.push(`rig.cloth[${s}].parent: must name an earlier cloth entry`), ((i.columns ?? 2) < 2 || (i.rows ?? 2) < 2) && n.push(`rig.cloth[${s}]: columns and rows must be at least 2`), i.seams?.length === 1 && n.push(`rig.cloth[${s}].seams: at least two columns required`), i.seams?.length || i.tiers?.length) {
      i.seams?.some((u) => u.some((y, v) => v > 0 && y[1] <= u[v - 1][1])) && n.push(`rig.cloth[${s}].seams: y must increase from waist to hem`);
      try {
        kn(i);
      } catch (u) {
        n.push(`rig.cloth[${s}]: ${u instanceof Error ? u.message : String(u)}`);
      }
    }
    o.add(i.name);
  }
  return n;
}
function en(e) {
  const t = Ln(e);
  if (t.length) throw new Error(`Invalid rig:
${t.join(`
`)}`);
  return structuredClone(e);
}
const Ke = (e, t, n) => Math.max(t, Math.min(n, e)), Ye = (e, t, n) => {
  const r = Ke((n - e) / (t - e), 0, 1);
  return r * r * (3 - 2 * r);
}, At = (e, t) => Math.hypot(e[0] - t[0], e[1] - t[1]), vt = (e, t, n) => {
  const r = e[0] - t[0], o = e[1] - t[1], s = Math.cos(n), i = Math.sin(n);
  return [t[0] + r * s - o * i, t[1] + r * i + o * s];
};
function cn(e, t, n, r) {
  const o = At(e, t), s = At(n, r), i = (t[0] - e[0]) / o, u = (t[1] - e[1]) / o, y = (r[0] - n[0]) / s, v = (r[1] - n[1]) / s, m = s / o, l = [
    y * m * i + v * u,
    y * m * u - v * i,
    v * m * i - y * u,
    v * m * u + y * i
  ];
  return [...l, n[0] - l[0] * e[0] - l[1] * e[1], n[1] - l[2] * e[0] - l[3] * e[1]];
}
const hn = (e, t) => [t[0] * e[0] + t[1] * e[1] + t[4], t[2] * e[0] + t[3] * e[1] + t[5]], kt = Object.freeze({ spine: 0.7, bob: 2, twist: 0 });
function Qn(e, t, n = null) {
  if (!e) return null;
  const r = [e.left, e.right].map((F, j) => {
    const C = At(F.hip, F.knee), B = At(F.knee, F.ankle), H = Math.min(C, B) * 0.05, N = Math.hypot(C, H), ne = Math.hypot(B, H), Q = F.ankle[0] - F.hip[0], J = F.ankle[1] - F.hip[1], X = Q * (F.knee[1] - F.hip[1]) - J * (F.knee[0] - F.hip[0]);
    return { ...F, u: N, v: ne, depth: H, lateral: X / Math.hypot(Q, J), side: Math.sign(X) || (j ? 1 : -1) };
  }), o = (e.twist ?? 0) > 0, s = (e.twist ?? 0) * Math.PI / 180, i = Math.max(1, ...r.map((F) => Math.abs(F.hip[0] - e.pelvis[0]) * 1.35)), u = Math.max(t.chest.rx, ...t.shoulders.map((F) => Math.abs(F.cx - t.chest.cx) + F.rx)), y = [0, 0], v = [0, 0];
  let m = 0;
  const l = (F, j, C, B) => {
    const H = F - j, N = Math.max(0, 1 - (H / C) ** 2);
    return H * (Math.cos(B) - 1) + C * 0.75 * N * N * Math.sin(B);
  }, c = [0, 0, 0], f = [0, 0, 0];
  let h = 0, p = 0, g = 0, b = 0, a;
  function d(F, j) {
    const C = Ke(F.weightShift ?? 0, -1, 1), B = Math.min(Math.max(j, 0), 0.05), H = v[0], N = o ? s * Ke(0.4 * C + (B ? 0.6 * Math.tanh((C - g) / B) : 0), -1, 1) : 0;
    if (!B)
      o && (y.fill(N), v.fill(0), m = 0), c.fill(C), f.fill(0), h = 0, p = 0;
    else {
      const ne = (e.bob ?? kt.bob) * Math.min(1, Math.abs(C - g) / B / 1.5), Q = Math.ceil(B * 240), J = B / Q;
      for (let X = 0; X < Q; X++) {
        for (let G = 0; G < 3; G++) {
          const re = G ? c[G - 1] : C;
          f[G] += (576 * (re - c[G]) - 2 * 0.9 * 24 * f[G]) * J, c[G] += f[G] * J;
        }
        if (o) for (let G = 0; G < 2; G++) {
          const re = G ? y[0] : N;
          v[G] += (196 * (re - y[G]) - 2 * 0.95 * 14 * v[G]) * J, y[G] += v[G] * J;
        }
        p += (576 * (ne - h) - 2 * 0.9 * 24 * p) * J, h += p * J;
      }
    }
    o && B && (m = (v[0] - H) / B), g = C, b++;
  }
  const x = Math.min(...r.map((F) => F.ankle[1]));
  let w, A, L;
  function z(F) {
    const j = Ke(F.weightShift ?? 0, -1, 1), C = Ke(F.bodyAngleX ?? 0, -10, 10);
    if (j === w && C === A && b === a) return L;
    w = j, A = C, a = b;
    const B = -e.tilt * j, H = e.shift * j + C / 10 * (t.hip?.shift ?? e.shift), N = o ? b ? y[0] : s * 0.4 * j : 0, ne = o ? -(1 - (e.spine ?? kt.spine)) * (b ? y[1] : N) : 0, Q = (V) => {
      const M = vt(V, e.pelvis, B);
      return o && (M[0] += l(V[0], e.pelvis[0], i, N)), M[0] += H, M;
    }, J = r.map((V) => Q(V.hip)), X = r.map((V, M) => V.lateral + V.side * e.bend * Math.max(0, M ? -j : j) ** 2), G = j * j + (C / 10) ** 2, re = e.bend ** 2 / Math.min(...r.map((V) => V.u + V.v)) * G, W = (V) => (V + Math.hypot(V, re)) / 2;
    let te = h + e.bend ** 2 / Math.min(...r.map((V) => V.u + V.v)) * j * j;
    for (let V = 0; V < r.length; V++) {
      const M = r[V], E = J[V], O = E[0] - M.ankle[0], k = Math.sqrt(Math.max(0, M.u * M.u - X[V] ** 2)) + Math.sqrt(Math.max(0, M.v * M.v - X[V] ** 2)), $ = M.ankle[1] - Math.sqrt(Math.max(0, k * k - O * O)) - E[1];
      te += W($ - te);
    }
    const ae = r.map((V, M) => {
      const E = [J[M][0], J[M][1] + te], O = V.ankle;
      if (!j && !C && !h && !N) return {
        hip: V.hip,
        knee: V.knee,
        ankle: O,
        hip3: [...V.hip, 0],
        knee3: [...V.knee, V.depth],
        ankle3: [...O, 0],
        upper: [1, 0, 0, 1, 0, 0],
        lower: [1, 0, 0, 1, 0, 0]
      };
      const k = O[0] - E[0], $ = O[1] - E[1], Z = Math.hypot(k, $), _ = (V.u * V.u - V.v * V.v + Z * Z) / (2 * Z), D = Math.sqrt(Math.max(0, V.u * V.u - _ * _)), q = [
        E[0] + k / Z * _ - $ / Z * X[M],
        E[1] + $ / Z * _ + k / Z * X[M]
      ], ee = Math.sqrt(Math.max(0, D * D - X[M] ** 2));
      return {
        hip: E,
        knee: q,
        ankle: O,
        hip3: [...E, 0],
        knee3: [...q, ee],
        ankle3: [...O, 0],
        upper: cn(V.hip, V.knee, E, q),
        lower: cn(V.knee, V.ankle, q, O)
      };
    });
    return L = {
      ws: j,
      bx: C,
      angle: B,
      shift: H,
      drop: te,
      bones: ae,
      ...o && { twist: { pelvis: N, shoulder: ne, head: 0, acceleration: m } },
      trunk: { spine: c[0], chest: c[1], head: c[2], bob: h }
    }, L;
  }
  function Y(F) {
    const j = e.split;
    let C = 0;
    for (; C < j.length - 2 && F > j[C + 1][1]; ) C++;
    const B = j[C], H = j[C + 1], N = Ke((F - B[1]) / (H[1] - B[1]), 0, 1);
    return B[0] + (H[0] - B[0]) * N;
  }
  function I(F, j) {
    const C = j >= e.split[0][1] ? +(F >= Y(j)) : Ye(Y(j) - 4, Y(j) + 4, F), B = r.map((H) => ({
      leg: Ye(e.band[0], H.hip[1], j),
      shin: Ye(H.knee[1] - 45, H.knee[1] + 45, j),
      pin: 1 - Ye(H.ankle[1] - 55, H.ankle[1], j)
    }));
    return { right: C, perBone: B };
  }
  function U(F, j, C, B, H) {
    const N = z(H);
    if (!N.ws && !N.bx && !N.trunk.chest && !N.trunk.head && !h && !N.twist?.pelvis && !N.twist?.shoulder) return;
    const ne = [e.pelvis[0] + N.shift, e.pelvis[1] + N.drop], Q = 1 - Ye(Math.min(t.chest.cy, e.pelvis[1] - 1), e.pelvis[1], C), J = 1 - Ye(...e.band, C), X = e.spine ?? kt.spine, G = e.tilt * (1 - X) * N.trunk.chest, re = e.shift * (1.12 * N.trunk.chest - N.ws) + Math.sin(G) * Math.max(0, e.pelvis[1] - t.chest.cy), W = (M) => {
      const E = vt(M, e.pelvis, N.angle);
      E[0] += N.shift, E[1] += N.drop;
      const O = vt(E, ne, (G - N.angle) * J);
      return O[0] += re * Q, O;
    }, te = W(F);
    if (n) {
      const M = 1 - Ye(...n.weightBand, C), E = W([n.pivotX, n.pivotY]), O = -e.tilt * (1 - X) * N.trunk.head * M, k = vt(te, E, O);
      te[0] = k[0] + e.shift * 1.12 * (N.trunk.head - N.trunk.chest) * M, te[1] = k[1];
    }
    if (o) {
      const M = t.chest.cy + Math.max(40, (e.pelvis[1] - t.chest.cy) * 0.5), E = Ye(t.chest.cy, M, C), O = N.twist.shoulder + (N.twist.pelvis - N.twist.shoulder) * E, k = t.chest.cx + (e.pelvis[0] - t.chest.cx) * E, $ = u + (i - u) * E, Z = n ? Ye(...n.weightBand, C) : 1;
      te[0] += l(j, k, $, O) * Z;
    }
    let ae = 0, V = 0;
    r.forEach((M, E) => {
      const O = N.bones[E], k = B.perBone[E], $ = hn(F, O.upper), Z = hn(F, O.lower), _ = $[0] + (Z[0] - $[0]) * k.shin, D = $[1] + (Z[1] - $[1]) * k.shin, q = E ? B.right : 1 - B.right;
      ae += ((te[0] - F[0]) * (1 - k.leg) + (_ - F[0]) * k.leg) * k.pin * q, V += ((te[1] - F[1]) * (1 - k.leg) + (D - F[1]) * k.leg) * k.pin * q;
    }), F[0] += ae, F[1] += V;
  }
  function T(F) {
    return 1 - Ye(x - 55, x, F);
  }
  return { frame: z, weights: I, apply: U, pin: T, step: d };
}
const Ge = (e, t, n) => Math.max(t, Math.min(n, e)), at = (e, t = 0) => Number.isFinite(e) ? e : t, it = (e, t, n) => {
  const r = Ge((n - e) / Math.max(1e-6, t - e), 0, 1);
  return r * r * (3 - 2 * r);
}, Lt = (e, t, n) => {
  const r = e[0] - t[0], o = e[1] - t[1], s = Math.cos(n), i = Math.sin(n);
  return [t[0] + r * s - o * i, t[1] + r * i + o * s];
}, mt = Object.freeze({ swing: 4, bend: 6, inward: 0.4 });
function er(e, t, n = null) {
  if (!e) return null;
  const r = Ge(at(e.swing, mt.swing), 0, 10) * Math.PI / 180, o = Ge(at(e.bend, mt.bend), 0, 12) * Math.PI / 180, s = Ge(at(e.inward, mt.inward), 0, 1), i = [e.left, e.right];
  function u(l, c) {
    let f = 0;
    for (; f < l.length - 2 && c > l[f + 1][1]; ) f++;
    const h = l[f], p = l[f + 1], g = Ge((c - h[1]) / Math.max(1e-6, p[1] - h[1]), 0, 1);
    return h[0] + (p[0] - h[0]) * g;
  }
  function y(l, c) {
    return i.map((f, h) => {
      const p = Math.max(1, f.elbow[1] - f.shoulder[1]), g = Math.max(1, f.wrist[1] - f.elbow[1]), b = Math.max(1, Math.min(p, g, t.chest.ry) * 0.2), a = u(f.split, c), d = h ? l - a : a - l, x = +(d >= 0), w = it(-b, b, d), A = it(f.split[0][1] - b, f.split[0][1], c);
      return {
        arm: (w + (x - w) * A) * it(f.shoulder[1], f.shoulder[1] + p * 0.55, c) * (1 - it(f.split.at(-1)[1], f.split.at(-1)[1] + b, c)),
        forearm: it(f.elbow[1] - b, f.elbow[1] + b, c)
      };
    });
  }
  function v(l, c = (f) => [...f]) {
    return i.map((f, h) => {
      const p = h ? "R" : "L", g = h ? -1 : 1, b = Ge(at(l[`armSwing${p}`]), -1, 1);
      return {
        shoulder: c(f.shoulder),
        elbow: c(f.elbow),
        swing: g * r * b * (b < 0 ? s : 1),
        // Flex inward; negative values never hyper-extend the elbow.
        bend: -g * o * Ge(at(l[`elbowBend${p}`]), 0, 1)
      };
    });
  }
  function m(l, c, f, h, p, g = v(p)) {
    const b = [...l];
    g.forEach((a, d) => {
      if (!h[d].arm || !a.swing && !a.bend) return;
      const x = a.swing ? Lt(b, a.shoulder, a.swing) : b, w = a.swing ? Lt(a.elbow, a.shoulder, a.swing) : a.elbow, A = a.bend ? Lt(x, w, a.bend) : x;
      l[0] += (x[0] - b[0] + (A[0] - x[0]) * h[d].forearm) * h[d].arm, l[1] += (x[1] - b[1] + (A[1] - x[1]) * h[d].forearm) * h[d].arm;
    });
  }
  return { weights: y, frame: v, apply: m };
}
const bt = [
  { id: "angleX", label: "Face angle X", min: -30, max: 30, def: 0, group: "Head and body" },
  { id: "angleY", label: "Face angle Y", min: -30, max: 30, def: 0, group: "Head and body" },
  { id: "angleZ", label: "Face roll", min: -30, max: 30, def: 0, group: "Head and body" },
  { id: "bodyAngleX", label: "Body angle X", min: -10, max: 10, def: 0, group: "Head and body" },
  { id: "bodyAngleZ", label: "Body roll", min: -10, max: 10, def: 0, group: "Head and body" },
  { id: "breath", label: "Breath", min: 0, max: 1, def: 0, group: "Head and body" },
  { id: "eyeLOpen", label: "Left eye open", min: 0, max: 1.25, def: 1, group: "Eyes and brows" },
  { id: "eyeROpen", label: "Right eye open", min: 0, max: 1.25, def: 1, group: "Eyes and brows" },
  { id: "eyeSmile", label: "Eye smile", min: 0, max: 1, def: 0, group: "Eyes and brows" },
  { id: "gazeX", label: "Gaze X", min: -1, max: 1, def: 0, group: "Eyes and brows" },
  { id: "gazeY", label: "Gaze Y", min: -1, max: 1, def: 0, group: "Eyes and brows" },
  { id: "browY", label: "Brow Y", min: -1, max: 1, def: 0, group: "Eyes and brows" },
  { id: "browAngle", label: "Brow angle", min: -1, max: 1, def: 0, group: "Eyes and brows" },
  { id: "mouthOpen", label: "Mouth open", min: 0, max: 1, def: 0, group: "Mouth and cheeks" },
  { id: "mouthForm", label: "Mouth form (i to o)", min: -1, max: 1, def: 0, group: "Mouth and cheeks" },
  { id: "blush", label: "Blush", min: 0, max: 1, def: 0, group: "Mouth and cheeks" },
  { id: "armAngle", label: "Arm angle", min: -10, max: 10, def: 0, group: "Hand" },
  { id: "handAngle", label: "Wrist angle", min: -10, max: 10, def: 0, group: "Hand" },
  { id: "fingerTap", label: "Finger tap", min: 0, max: 1, def: 0, group: "Hand" },
  { id: "weightShift", label: "Weight shift", min: -1, max: 1, def: 0, group: "Legs" },
  ...["L", "R"].flatMap((e) => [
    { id: `armSwing${e}`, label: `Arm swing ${e}`, min: -1, max: 1, def: 0, group: "Arms" },
    { id: `elbowBend${e}`, label: `Elbow bend ${e}`, min: 0, max: 1, def: 0, group: "Arms" }
  ])
];
function tr(e) {
  const t = { w: e.image.width, h: e.image.height }, n = (M, E, O) => O ? Math.exp(-(((M - O.cx) / O.rx) ** 2 + ((E - O.cy) / O.ry) ** 2)) : 0, r = 24, o = e.eyes;
  function s(M, E) {
    const O = Math.min(1, Math.max(0, E)) * (r - 1), k = Math.min(Math.floor(O), r - 2), $ = O - k;
    return M[k] + (M[k + 1] - M[k]) * $;
  }
  function i(M, E, O, k) {
    E = Math.min(1, Math.max(0, E));
    const $ = s(M.top, E), Z = s(M.bot, E), _ = 1 - O, D = 4 * E * (1 - E), q = s(M.bot, 0.5) - s(M.top, 0.5), ee = M.top[0] + (M.top[r - 1] - M.top[0]) * E - 0.3 * q * D, oe = Math.max($, Z + 1 + (ee - Z - 1) * k);
    return [(oe - $) * Math.max(_, -0.07), _ > 0 ? (oe - Z) * _ * k : 0];
  }
  const u = [[-2, 1], [-1, 2], [0, 3], [1, 2], [2, 1]], y = 5;
  function v(M, E, O, k) {
    let $ = 0, Z = 0;
    for (const [ee, oe] of u) {
      const [S, R] = i(M, (E + ee * y - M.x0) / (M.x1 - M.x0), O, k);
      $ += S * oe / 9, Z += R * oe / 9;
    }
    const _ = Math.min(1, Math.max(0, (E - M.x0) / (M.x1 - M.x0))), D = s(M.top, _), q = s(M.bot, _);
    return { top: D, bot: q, b: 1 - O, lid: D + $, bc: q + Z };
  }
  function m(M, E, O, k, $, Z) {
    const _ = v(M, O, $, Z);
    return E === "lash" ? _.lid - (_.top - k) * (1 - 0.3 * Math.min(1, Math.max(0, _.b))) : E === "low" ? k + (_.bc - _.bot) : E === "crease" ? k + (_.lid - _.top) * 0.22 : k;
  }
  function l(M, E, O) {
    const k = Math.min(1, Math.max(0, 1 - E));
    return M === "low" ? 1 - Math.min(1, k * O * 1.2) : M === "crease" ? 1 - 0.45 * k : 1;
  }
  const c = e.mouth, f = e.cheeks, h = e.head, p = e.body, g = Qn(e.legs, p, h), b = er(e.arms, p, e.legs), a = (M, E, O) => {
    const k = Math.min(1, Math.max(0, (O - M) / (E - M)));
    return k * k * (3 - 2 * k);
  };
  function d(M, E) {
    return 1 - a(...h.weightBand, E);
  }
  function x(M, E) {
    return 1 - a(...h.turnBand, E);
  }
  const w = e.strands ?? [];
  function A(M, E, O) {
    let k = 1 / 0, $ = 0;
    const Z = O.length - 1;
    for (let _ = 0; _ < Z; _++) {
      const [D, q] = O[_], [ee, oe] = O[_ + 1], S = ee - D, R = oe - q, P = Math.min(1, Math.max(0, ((M - D) * S + (E - q) * R) / (S * S + R * R))), se = Math.hypot(M - D - S * P, E - q - R * P);
      se < k && (k = se, $ = (_ + P) / Z);
    }
    return [k, $];
  }
  function L(M, E, O) {
    if (O < 0.02) return [];
    const k = [];
    let $ = 0;
    w.forEach((_, D) => {
      const [q, ee] = A(M, E, _.nodes), oe = Math.exp(-((q / _.sigma) ** 2));
      oe < 0.02 || (k.push([D, oe, ee]), $ += oe);
    });
    const Z = Math.max(1, $);
    return k.map(([_, D, q]) => [_, O * D / Z * a(0.04, 0.55, q), q]);
  }
  function z(M, E, O = 1) {
    return {
      head: d(M, E),
      turn: x(M, E),
      strands: L(M, E, O),
      bunL: n(M, E, e.buns?.bunL),
      bunR: n(M, E, e.buns?.bunR),
      brow: n(M, E, e.face.brow) * (1 - a(...e.face.brow.band, E)),
      // chin below the mouth line drops a little when the mouth opens
      jaw: n(M, E, e.face.jaw) * a(...e.face.jaw.band, E),
      // per-feature depth for head turns (nose sticks out most, ears sit at the back)
      nose: n(M, E, e.face.nose),
      mouth: n(M, E, e.face.mouth),
      eyeA: n(M, E, e.face.eyeA),
      eyeB: n(M, E, e.face.eyeB),
      earR: n(M, E, e.face.earR),
      earL: n(M, E, e.face.earL),
      chest: n(M, E, p.chest),
      breath: 1 - a(...p.breathBand, E),
      shoulder: p.shoulders.reduce((k, $) => k + n(M, E, $), 0),
      ...g && { legs: g.weights(M, E) },
      ...b && { arms: b.weights(M, E) }
    };
  }
  function Y(M, E, O, k) {
    const $ = (M - h.cx) / h.rx, Z = (E - h.cy) / h.ry, _ = 1 - $ * $ - Z * Z;
    if (_ <= 0) return [0, 0];
    const D = a(0, 0.84, _);
    return [O * h.shiftX * D, -k * h.shiftY * D];
  }
  function I(M, E, O, k) {
    const $ = Math.cos(k), Z = Math.sin(k), _ = M[0] - E, D = M[1] - O;
    M[0] = E + _ * $ - D * Z, M[1] = O + _ * Z + D * $;
  }
  function U(M, E, O, k = E) {
    const $ = Y(M[0], M[1], O.angleX / 30, O.angleY / 30);
    M[0] += $[0] * k, M[1] += $[1] * k, !(E <= 0) && I(M, h.pivotX, h.pivotY, -O.angleZ / 30 * h.maxRoll * E);
  }
  function T(M, E, O, k = 0, $ = 1, Z = 0, _) {
    g && g.apply(M, M[0], E, _ ?? g.weights(M[0], E), O);
    const D = M[0], q = M[1], ee = O.breath;
    M[1] -= ee * (5 * $ + 4 * Z), M[0] += (M[0] - p.chest.cx) * 0.012 * ee * k;
    const oe = p.hip;
    if (g || (M[0] += O.bodyAngleX / 10 * (oe ? oe.shift * (1 - a(...oe.band, E)) : 7 + 9 * k)), I(M, p.pivotX, p.pivotY, -O.bodyAngleZ / 10 * p.maxRoll * (1 - a(...p.rollBand, E))), g) {
      const S = g.pin(E);
      M[0] = D + (M[0] - D) * S, M[1] = q + (M[1] - q) * S;
    }
  }
  let F, j;
  function C(M, E, O, k, $, Z) {
    const _ = Z;
    if (_[0] = M, _[1] = E, g && !g.pin(E)) return _;
    const D = $.gain;
    for (const [oe, S, R] of O.strands) {
      const P = $.strands?.[oe];
      if (!P) continue;
      const se = R * 3, ie = Math.min(2, Math.floor(se)), pe = se - ie;
      _[0] += (P[ie][0] + (P[ie + 1][0] - P[ie][0]) * pe) * S * D, _[1] += (P[ie][1] + (P[ie + 1][1] - P[ie][1]) * pe) * S * D;
    }
    if (_[0] += ($.bunL[0] * O.bunL + $.bunR[0] * O.bunR) * D, _[1] += ($.bunL[1] * O.bunL + $.bunR[1] * O.bunR) * D, _[1] -= k.browY * 7 * O.brow, O.brow > 0.01) {
      const oe = k.browAngle * 0.12 * O.brow;
      _[1] += (M - e.face.brow.cx) * Math.sin(oe);
    }
    _[1] += k.mouthOpen * 3.5 * O.jaw;
    const q = k.angleX / 30, ee = k.angleY / 30;
    if (_[0] += q * (8 * O.nose + 5 * O.mouth) + (M - e.face.eyeA.cx) * 0.12 * q * O.eyeA - (M - e.face.eyeB.cx) * 0.12 * q * O.eyeB - q * 9 * O.earR + q * 4 * O.earL - q * 10 * (O.bunL + O.bunR), _[1] -= ee * (6 * O.nose + 3 * O.mouth), _[1] += (E - e.face.eyeA.cy) * -0.06 * Math.abs(ee) * O.eyeA + (E - e.face.eyeB.cy) * -0.06 * Math.abs(ee) * O.eyeB, U(_, O.head, k, O.turn), T(_, E, k, O.chest, O.breath, O.shoulder, O.legs), b && O.arms.some((oe) => oe.arm > 0)) {
      const oe = [
        k.angleX,
        k.angleY,
        k.angleZ,
        k.bodyAngleX,
        k.bodyAngleZ,
        k.breath,
        k.armSwingL,
        k.armSwingR,
        k.elbowBendL,
        k.elbowBendR,
        g?.frame(k)
      ];
      (!F || oe.some((S, R) => S !== F[R])) && (F = oe, j = b.frame(k, (S) => {
        const R = [...S], P = z(...S, 0);
        return U(R, P.head, k, P.turn), T(R, S[1], k, P.chest, P.breath, P.shoulder, P.legs), R;
      })), b.apply(_, M, E, O.arms, k, j);
    }
    return _;
  }
  const B = e.hand, H = B?.elbow ?? [0, 0], N = B?.wrist ?? [0, 0], ne = B?.knuckle ?? [0, 0], Q = B?.contact ?? [0, 0], J = B?.forearmShare ?? 0;
  function X(M, E) {
    return B ? {
      arm: 1 - a(...B.armBand, E),
      wrist: 1 - a(...B.wristBand, E),
      hand: 1 - a(...B.handBand, E),
      finger: a(...B.fingerXBand, M) * (1 - a(...B.fingerYBand, E)),
      pinBottom: a(...B.pinBand, E)
    } : { arm: 0, wrist: 0, hand: 0, finger: 0, pinBottom: 0 };
  }
  const G = (M, E, O, k) => {
    const $ = M[0] - E[0], Z = M[1] - E[1];
    return [E[0] + $ * O - Z * k, E[1] + $ * k + Z * O];
  }, re = (M) => Math.atan2(M[1], M[0]);
  function W(M) {
    const E = [...Q];
    U(E, d(...Q), M, x(...Q)), T(E, Q[1], M, 0, 1, 0);
    const O = [...H];
    T(O, H[1], M, 0, 0, 0);
    const $ = (re([E[0] - O[0], E[1] - O[1]]) - re([Q[0] - H[0], Q[1] - H[1]])) * J, Z = Math.cos($), _ = Math.sin($), D = (R) => {
      const P = G(R, H, Z, _);
      return [P[0] + O[0] - H[0], P[1] + O[1] - H[1]];
    }, q = D(N), ee = D(Q), oe = re([E[0] - q[0], E[1] - q[1]]) - re([ee[0] - q[0], ee[1] - q[1]]), S = Math.min(1.03, Math.max(0.97, Math.hypot(E[0] - q[0], E[1] - q[1]) / Math.hypot(ee[0] - q[0], ee[1] - q[1])));
    return { tr: D, w: q, b: oe, k: S };
  }
  function te(M, E, O, k, $, Z) {
    let _ = [M, E];
    _ = G(_, ne, Math.cos(k.fingerTap * 0.07 * O.finger), Math.sin(k.fingerTap * 0.07 * O.finger));
    const D = -k.handAngle / 10 * 0.045 * O.wrist, q = -k.armAngle / 10 * 0.015 * O.arm;
    _ = G(_, N, Math.cos(D), Math.sin(D)), _ = G(_, H, Math.cos(q), Math.sin(q)), _ = $.tr(_);
    const ee = $.b * O.hand, oe = 1 + ($.k - 1) * O.hand;
    return _ = G(_, $.w, Math.cos(ee) * oe, Math.sin(ee) * oe), _[1] += (E - _[1]) * O.pinBottom, Z[0] = _[0], Z[1] = _[1], Z;
  }
  const ae = e.accessories ?? [];
  function V(M, E, O, k) {
    const $ = z(M.pivot[0], M.pivot[1]);
    return C(M.pivot[0], M.pivot[1], $, E, O, k);
  }
  return { legs: g, stepBody: (M, E) => g?.step(M, E), IMG: t, EYES: o, MOUTH: c, CHEEKS: f, STRANDS: w, TASSELS: ae, headWeight: d, turnWeight: x, baseWeights: z, deformBase: C, applyHead: U, applyBody: T, handWeights: X, handFrame: W, deformHand: te, eyePartY: m, eyePartAlpha: l, tasselAnchor: V };
}
function nr(e, t, n, r = !1) {
  const o = r ? Math.max(t, n) * 2 : 1, s = new Float32Array(e.length), i = Math.SQRT2;
  for (let u = 0; u < n; u++) for (let y = 0; y < t; y++) {
    const v = u * t + y;
    e[v] <= 3 || (s[v] = Math.min(
      y ? s[v - 1] + 1 : o,
      u ? s[v - t] + 1 : o,
      y && u ? s[v - t - 1] + i : o,
      u && y + 1 < t ? s[v - t + 1] + i : o
    ));
  }
  for (let u = n - 1; u >= 0; u--) for (let y = t - 1; y >= 0; y--) {
    const v = u * t + y;
    !e[v] || e[v] <= 3 || (s[v] = Math.min(
      s[v],
      y + 1 < t ? s[v + 1] + 1 : o,
      u + 1 < n ? s[v + t] + 1 : o,
      y && u + 1 < n ? s[v + t - 1] + i : o,
      y + 1 < t && u + 1 < n ? s[v + t + 1] + i : o
    ));
  }
  return s;
}
function _t(e, t, n) {
  return Math.exp(-(((e - n.cx) / n.rx) ** 2 + ((t - n.cy) / n.ry) ** 2));
}
function rr(e, t, n) {
  const r = ((e - n.head.cx) / n.head.rx) ** 2 + ((t - n.head.cy) / n.head.ry) ** 2;
  let o = n.head.rx * 0.8 * Math.sqrt(Math.max(0, 1 - r)) + n.body.chest.rx * 0.23 * _t(e, t, n.body.chest);
  o += n.face.nose.rx * 0.2 * _t(e, t, n.face.nose);
  for (const [s, i] of n.cheeks) o += n.head.rx * 0.012 * _t(e, t, { cx: s, cy: i, rx: n.head.rx * 0.3, ry: n.head.ry * 0.16 });
  return o;
}
function Et(e, t, n, r) {
  const o = new Float32Array(e.length), s = new Float32Array(e.length), i = (u, y, v, m, l, c) => {
    for (let f = 0; f < m; f++) {
      const h = f * c;
      let p = 0, g = 0;
      for (let b = 0; b < Math.min(r, v - 1) + 1; b++)
        p += u[h + b * l], g++;
      for (let b = 0; b < v; b++) {
        y[h + b * l] = p / g;
        const a = b + r + 1, d = b - r;
        a < v && (p += u[h + a * l], g++), d >= 0 && (p -= u[h + d * l], g--);
      }
    }
  };
  return i(e, o, t, n, 1, t), i(o, s, n, t, t, 1), s;
}
function or(e, t, n, r) {
  const o = Et(e, n, r, 1), s = Et(e, n, r, 6), i = new Float32Array(e.length);
  for (let v = 0; v < i.length; v++) i[v] = t[v] > 128 ? o[v] - s[v] : 0;
  const u = new Float32Array(e.length * 2), y = (v, m) => i[Math.max(0, Math.min(r - 1, m)) * n + Math.max(0, Math.min(n - 1, v))];
  for (let v = 0; v < r; v++) for (let m = 0; m < n; m++) {
    const l = v * n + m;
    t[l] <= 128 || (u[2 * l] = Math.max(-1, Math.min(1, -(y(m + 1, v) - y(m - 1, v)) * 4)), u[2 * l + 1] = Math.max(-1, Math.min(1, -(y(m, v + 1) - y(m, v - 1)) * 4)));
  }
  return u;
}
function sr(e, t, n, r, o, s = !0, i) {
  const u = !!o && r[0] === 0 && r[1] === 0 && r[2] === o.image.width && r[3] === o.image.height, y = nr(e, t, n, u), v = new Float32Array(e.length), m = r[2] / t, l = r[3] / n, c = Math.min(m, l), f = Math.min(r[2], r[3]) * 0.08;
  for (let a = 0; a < n; a++) for (let d = 0; d < t; d++) {
    const x = a * t + d;
    v[x] = (s ? Math.sqrt(y[x] * c * f) * 0.55 : 0) + (o ? rr(r[0] + (d + 0.5) * m, r[1] + (a + 0.5) * l, o) : 0);
  }
  const h = Math.max(1, Math.round(Math.min(t, n) * 0.02));
  v.set(Et(Et(v, t, n, h), t, n, h));
  const p = i ? or(i, e, t, n) : null, g = new Uint8Array(t * n * 4), b = (a, d) => v[Math.max(0, Math.min(n - 1, d)) * t + Math.max(0, Math.min(t - 1, a))];
  for (let a = 0; a < n; a++) for (let d = 0; d < t; d++) {
    const x = -(b(d + 2, a) - b(d - 2, a)) / (4 * m), w = -(b(d, a + 2) - b(d, a - 2)) / (4 * l), A = Math.hypot(x, w, 1), L = (a * t + d) * 4, z = a * t + d;
    g[L] = Math.round((x / A * 0.5 + 0.5) * 255), g[L + 1] = Math.round((w / A * 0.5 + 0.5) * 255), g[L + 2] = Math.round(((p?.[2 * z] ?? 0) * 0.5 + 0.5) * 255), g[L + 3] = Math.round(((p?.[2 * z + 1] ?? 0) * 0.5 + 0.5) * 255);
  }
  return g;
}
const un = /* @__PURE__ */ new WeakMap();
function ar(e, t, n, r) {
  const o = JSON.stringify([t, n.head, n.body.chest, n.face.nose, n.cheeks, r]), s = un.get(e);
  if (s?.key === o) return { ...s, computed: !1, ms: 0 };
  const i = performance.now(), u = Math.min(1, 512 / Math.max(e.width, e.height)), y = Math.max(1, Math.round(e.width * u)), v = Math.max(1, Math.round(e.height * u)), m = document.createElement("canvas");
  m.width = y, m.height = v;
  const l = m.getContext("2d", { willReadFrequently: !0 });
  l.drawImage(e, 0, 0, y, v);
  const c = l.getImageData(0, 0, y, v).data, f = new Uint8Array(y * v), h = new Float32Array(y * v);
  for (let g = 0; g < f.length; g++)
    f[g] = c[4 * g + 3], h[g] = (0.2126 * c[4 * g] + 0.7152 * c[4 * g + 1] + 0.0722 * c[4 * g + 2]) / 255;
  const p = { key: o, data: sr(f, y, v, t, n, r, r ? h : void 0), width: y, height: v };
  return un.set(e, p), { ...p, computed: !0, ms: performance.now() - i };
}
const et = Object.freeze({
  enabled: !1,
  x: 0.2,
  y: 0.2,
  z: 0.45,
  color: 16777215,
  strength: 0.8,
  intensity: 0.8,
  ambient: 0.4,
  mode: "soft",
  shadow: !1,
  reach: 1.2,
  ambientColor: 15659256,
  softness: 0.45,
  specular: 0.12,
  rim: 0.3,
  detail: 0.4
}), fn = {
  x: [0, 1],
  y: [0, 1],
  z: [0.1, 2],
  color: [0, 16777215],
  strength: [0, 1],
  intensity: [0, 2],
  ambient: [0, 1],
  reach: [0.2, 3],
  ambientColor: [0, 16777215],
  softness: [0, 1],
  specular: [0, 1],
  rim: [0, 1],
  detail: [0, 1]
}, ir = /* @__PURE__ */ new Set(["color", "ambientColor"]);
function lr(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return null;
  const t = e;
  if (Object.keys(t).length !== Object.keys(et).length || Object.keys(t).some((r) => !(r in et)) || ![!0, !1].includes(t.enabled) || ![!0, !1].includes(t.shadow) || !["soft", "cel"].includes(t.mode)) return null;
  const n = { ...et, enabled: t.enabled, shadow: t.shadow, mode: t.mode };
  for (const r of Object.keys(fn)) {
    const o = t[r], [s, i] = fn[r];
    if (typeof o != "number" || !Number.isFinite(o) || ir.has(r) && !Number.isInteger(o)) return null;
    n[r] = Math.max(s, Math.min(i, o));
  }
  return n;
}
function Eo(e) {
  return `#${e.toString(16).padStart(6, "0")}`;
}
const wt = -0.1, cr = 0.9, hr = 1, ur = 1.06;
function fr(e, t) {
  return [(0.5 - e) * 0.12, (0.5 - t) * 0.12];
}
function mr(e, t, n, r) {
  const o = e * Math.PI / 180, s = t * Math.PI / 180, i = -n / 30 * r, u = Math.cos(o), y = Math.sin(o), v = Math.cos(s), m = Math.sin(s), l = Math.cos(i), c = Math.sin(i);
  return [
    l * u,
    c * u,
    -y,
    l * y * m - c * v,
    c * y * m + l * v,
    u * m,
    l * y * v + c * m,
    c * y * v - l * m,
    u * v
  ];
}
class pr {
  constructor(t, n) {
    this.gl = t, this.program = n(t, `#version 300 es
      out vec2 vUv;
      void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0, 1); }`, `#version 300 es
      precision highp float; in vec2 vUv; out vec4 o;
      uniform sampler2D uTex; uniform vec2 uStep; uniform vec2 uShift; uniform int uPass;
      float alphaAt(vec2 p) { if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) return 0.0; return texture(uTex, p).a; }
      void main() {
        if (uPass == 2) { o = texture(uTex, vUv); return; }
        vec2 p = vUv - uShift;
        float a = alphaAt(p) * 0.227027;
        a += (alphaAt(p + uStep * 1.384615) + alphaAt(p - uStep * 1.384615)) * 0.316216;
        a += (alphaAt(p + uStep * 3.230769) + alphaAt(p - uStep * 3.230769)) * 0.070270;
        o = uPass == 0 ? vec4(0, 0, 0, a) : vec4(vec3(0.035, 0.045, 0.065) * a * 0.28, a * 0.28);
      }`), this.vao = t.createVertexArray(), this.targets = [];
  }
  target(t, n) {
    const r = this.gl, o = r.createTexture(), s = r.createFramebuffer();
    if (r.bindTexture(r.TEXTURE_2D, o), r.texImage2D(r.TEXTURE_2D, 0, r.RGBA, t, n, 0, r.RGBA, r.UNSIGNED_BYTE, null), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_MIN_FILTER, r.LINEAR), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_MAG_FILTER, r.LINEAR), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_WRAP_S, r.CLAMP_TO_EDGE), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_WRAP_T, r.CLAMP_TO_EDGE), r.bindFramebuffer(r.FRAMEBUFFER, s), r.framebufferTexture2D(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0, r.TEXTURE_2D, o, 0), r.checkFramebufferStatus(r.FRAMEBUFFER) !== r.FRAMEBUFFER_COMPLETE) throw new Error("Shadow framebuffer unavailable");
    return { texture: o, framebuffer: s };
  }
  begin(t, n) {
    const r = this.gl;
    (this.width !== t || this.height !== n) && (this.clearTargets(), this.width = t, this.height = n, this.targets = [this.target(t, n), this.target(Math.ceil(t / 2), Math.ceil(n / 2))]), r.bindFramebuffer(r.FRAMEBUFFER, this.targets[0].framebuffer), r.viewport(0, 0, t, n), r.clearColor(0, 0, 0, 0), r.clear(r.COLOR_BUFFER_BIT);
  }
  composite(t) {
    const n = this.gl, { prog: r, u: o } = this.program, s = this.width, i = this.height;
    n.useProgram(r), n.bindVertexArray(this.vao), n.activeTexture(n.TEXTURE0), n.uniform1i(o.uTex, 0), n.disable(n.BLEND), n.bindFramebuffer(n.FRAMEBUFFER, this.targets[1].framebuffer), n.viewport(0, 0, Math.ceil(s / 2), Math.ceil(i / 2)), n.bindTexture(n.TEXTURE_2D, this.targets[0].texture), n.uniform1i(o.uPass, 0), n.uniform2f(o.uShift, 0, 0), n.uniform2f(o.uStep, 3 / s, 0), n.drawArrays(n.TRIANGLES, 0, 3), n.bindFramebuffer(n.FRAMEBUFFER, null), n.viewport(0, 0, s, i), n.clearColor(0, 0, 0, 0), n.clear(n.COLOR_BUFFER_BIT), n.enable(n.BLEND), n.bindTexture(n.TEXTURE_2D, this.targets[1].texture);
    const u = fr(t.x, t.y);
    n.uniform1i(o.uPass, 1), n.uniform2f(o.uShift, u[0], -u[1]), n.uniform2f(o.uStep, 0, 3 / i), n.drawArrays(n.TRIANGLES, 0, 3), n.bindTexture(n.TEXTURE_2D, this.targets[0].texture), n.uniform1i(o.uPass, 2), n.drawArrays(n.TRIANGLES, 0, 3), n.bindVertexArray(null);
  }
  clearTargets() {
    for (const t of this.targets)
      this.gl.deleteTexture(t.texture), this.gl.deleteFramebuffer(t.framebuffer);
    this.targets = [];
  }
  destroy() {
    this.clearTargets(), this.gl.deleteProgram(this.program.prog), this.gl.deleteVertexArray(this.vao);
  }
}
function dr(e, t) {
  const { IMG: n, EYES: r, MOUTH: o, CHEEKS: s } = e, i = `#version 300 es
  in vec2 aPos; in vec2 aUv;
  uniform vec2 uScale; uniform vec2 uOffset;
  out vec2 vUv;
  void main() { vUv = aUv; gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0); }`, u = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 outColor;
  uniform sampler2D uTex;
  uniform vec4 uRect;        // layer rect in source px
  uniform int uFace;
  uniform float uAlpha;
  uniform vec4 uEyeBox[2];   // x0, x1, -, -
  uniform float uEyeTop[48]; // 2 eyes x EYE_N samples
  uniform float uEyeBot[48];
  uniform vec4 uEyeState[2]; // open, smile, ballX(px), ballY(px)
  uniform vec4 uMouth;       // cx, cy, angle, halfLen
  uniform vec4 uMouthState;  // open, form, bow, -
  uniform vec4 uCheeks;      // x0, y0, x1, y1
  uniform float uCheek;

  const int EYE_N = 24;
  float crv(int e, bool top, float u) {
    float f = clamp(u, 0.0, 1.0) * float(EYE_N - 1);
    int i = min(int(floor(f)), EYE_N - 2);
    float t = f - float(i);
    int k = e * EYE_N + i;
    return top ? mix(uEyeTop[k], uEyeTop[k + 1], t) : mix(uEyeBot[k], uEyeBot[k + 1], t);
  }

  // Upper lid line and lower lid line of eye e at column u, for the current open/smile state.
  // Must match eyeLids() in rig.js, which moves the lash meshes to the same lines.
  // Must match eyeLidsRaw() / eyeLids() in rig.js.
  vec2 eyeLidsRaw(int e, float u) {
    u = clamp(u, 0.0, 1.0);
    vec4 st = uEyeState[e];
    float top = crv(e, true, u), bot = crv(e, false, u);
    float b = 1.0 - st.x, smile = st.y, hump = 4.0 * u * (1.0 - u);
    float H = crv(e, false, 0.5) - crv(e, true, 0.5);
    float arc = mix(uEyeTop[e * EYE_N], uEyeTop[e * EYE_N + EYE_N - 1], u) - 0.3 * H * hump;
    float closed = max(top, bot + 1.0 + (arc - bot - 1.0) * smile);
    return vec2((closed - top) * max(b, -0.07), b > 0.0 ? (closed - bot) * b * smile : 0.0);
  }

  vec2 eyeLids(int e, float u, float top, float bot) {
    vec4 box = uEyeBox[e];
    float du = 5.0 / (box.y - box.x);
    vec2 raw = eyeLidsRaw(e, u);
    vec2 d = (eyeLidsRaw(e, u - 2.0 * du) + 2.0 * eyeLidsRaw(e, u - du) + 3.0 * raw
            + 2.0 * eyeLidsRaw(e, u + du) + eyeLidsRaw(e, u + 2.0 * du)) / 9.0;
    // for hiding the ball take whichever closes more: the smoothed lash can sit a little
    // above the raw lid near the corners, and the gap must show lid skin, not eye white
    return vec2(top + max(d.x, raw.x), bot + min(d.y, raw.y));
  }

  vec4 texAt(vec2 p) { return texture(uTex, (p - uRect.xy) / uRect.zw); }

  // Eye white + iris layer: shown only between the lids (the lids cover it, it never squashes);
  // the iris slides inside the opening for the gaze.
  vec4 eyeBall(int e, vec2 p) {
    vec4 box = uEyeBox[e]; vec4 st = uEyeState[e];
    float u = clamp((p.x - box.x) / (box.y - box.x), 0.0, 1.0);
    float top = crv(e, true, u), bot = crv(e, false, u);
    vec2 lids = eyeLids(e, u, top, bot);
    float v = clamp((p.y - top) / max(bot - top, 1.0), 0.0, 1.0);
    float w = sqrt(4.0 * u * (1.0 - u)) * sqrt(4.0 * v * (1.0 - v));
    vec4 c = texAt(p - vec2(st.z, st.w) * w);
      // the lash covers ~2px of the ball's upper edge, so the cut can sit under it (no seam)
    return c * smoothstep(lids.x - 1.0, lids.x + 0.5, p.y) * (1.0 - smoothstep(lids.y - 0.9, lids.y + 0.6, p.y));
  }

  vec4 mouth(vec2 p, vec4 base) {
    float open = uMouthState.x;
    if (open < 0.01) return base;
    vec2 d = vec2(cos(uMouth.z), sin(uMouth.z)), n = vec2(-d.y, d.x);
    vec2 r = p - uMouth.xy;
    float s = dot(r, d) / uMouth.w, t = dot(r, n);
    float form = uMouthState.y;                       // -1 wide "i" .. +1 round "o"
    float wf = mix(0.78, 0.46, clamp(form * 0.5 + 0.5, 0.0, 1.0));
    float k = 1.0 - (s / wf) * (s / wf);
    if (k <= 0.0) return base;
    float line = uMouthState.z * (1.0 - s * s);
    float hk = pow(k, mix(0.55, 0.85, clamp(form, 0.0, 1.0)));
    float H = mix(20.0, 26.0, clamp(form, 0.0, 1.0));
    float up = line - 0.6 - open * 2.5 * hk;
    float lo = line + open * H * hk;
    float cov = smoothstep(-0.7, 0.7, t - up) * smoothstep(-0.7, 0.7, lo - t);
    if (cov <= 0.0) return base;
    float tv = clamp((t - up) / max(lo - up, 1.0), 0.0, 1.0);
    vec3 col = mix(vec3(0.24, 0.05, 0.08), vec3(0.48, 0.15, 0.19), tv);
    float tongue = smoothstep(0.5, 0.78, tv) * (1.0 - smoothstep(0.45, 0.8, abs(s) / wf));
    col = mix(col, vec3(0.86, 0.44, 0.47), tongue * 0.9);
    float teeth = (1.0 - smoothstep(0.12, 0.22, tv)) * smoothstep(0.25, 0.45, open) * (1.0 - smoothstep(0.55, 0.85, abs(s) / wf));
    col = mix(col, vec3(0.99, 0.96, 0.94), teeth);
    float rim = 1.0 - smoothstep(0.6, 1.8, lo - t);
    col = mix(col, vec3(0.36, 0.09, 0.11), rim * 0.85);
    return vec4(mix(base.rgb, col, cov), 1.0);
  }

  void main() {
    vec2 p = uRect.xy + vUv * uRect.zw;
    vec4 c;
    if (uFace == 1) {
      c = mouth(p, texAt(p));
      float blush = exp(-dot((p - uCheeks.xy) / vec2(48.0, 22.0), (p - uCheeks.xy) / vec2(48.0, 22.0)))
                  + exp(-dot((p - uCheeks.zw) / vec2(40.0, 20.0), (p - uCheeks.zw) / vec2(40.0, 20.0)));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.0, 0.62, 0.64) , clamp(blush * uCheek * 0.55, 0.0, 1.0) * c.a);
    } else if (uFace >= 2) {
      c = eyeBall(uFace - 2, p);
    } else {
      c = texAt(p);
    }
    outColor = c * uAlpha;
  }`, y = i.replace("out vec2 vUv;", "in float aHeadWeight; out float vHeadWeight; out vec2 vScreen; out vec2 vUv;").replace("vUv = aUv;", "vHeadWeight = aHeadWeight; vScreen = vec2((aPos.x * uScale.x + uOffset.x + 1.0) * 0.5, (1.0 - aPos.y * uScale.y - uOffset.y) * 0.5); vUv = aUv;"), v = u.replace("uniform sampler2D uTex;", `uniform sampler2D uTex;
    uniform sampler2D uNormal; in float vHeadWeight; in vec2 vScreen;
    uniform mat3 uHeadRotation; uniform vec3 uLight; uniform vec3 uLightColor; uniform vec3 uAmbientColor;
    uniform vec4 uLighting; uniform vec4 uSurface; uniform float uAspect; uniform int uCel;`).replace("outColor = c * uAlpha;", `
      // RG hold the smooth surface normal, BA the painting's relief (see lighting/normals.ts).
      vec4 encoded = texture(uNormal, vUv);
      vec2 base = encoded.rg * 2.0 - 1.0;
      vec3 n = vec3(base, sqrt(max(0.0, 1.0 - dot(base, base))));
      n = normalize(n + vec3((encoded.ba * 2.0 - 1.0) * uSurface.w * ${cr.toFixed(3)}, 0.0));
      n = normalize(mix(n, uHeadRotation * n, vHeadWeight));
      vec2 toLight = (uLight.xy - vScreen) * vec2(uAspect, 1.0);
      vec3 light = normalize(vec3(toLight, uLight.z));
      float ndl = dot(n, light);
      float diffuse;
      if (uCel == 1) {
        float w = 0.01 + uSurface.x * 0.08;
        diffuse = 0.2 + 0.45 * smoothstep(${wt.toFixed(3)} - w, ${wt.toFixed(3)} + w, ndl) + 0.35 * smoothstep(0.55 - w, 0.55 + w, ndl);
      } else {
        float s = 0.05 + uSurface.x * 0.5;
        diffuse = smoothstep(${wt.toFixed(3)} - s, ${wt.toFixed(3)} + s, ndl) * (0.35 + 0.65 * max(0.0, ndl));
      }
      float reach = dot(toLight, toLight) / (uLighting.w * uLighting.w);
      float attenuation = 1.0 / (1.0 + reach);
      vec3 radiance = uLightColor * uLighting.y * attenuation;
      // A light close to the surface may brighten a little, but must not bleach painted colours.
      vec3 irradiance = min(uAmbientColor * uLighting.z + radiance * diffuse, vec3(${ur.toFixed(3)}));
      // Painted shadows are deeper versions of the base colour, not grey: multiply by the colour
      // itself as the surface turns away from the light.
      vec3 albedo = c.rgb / max(c.a, 1e-4);
      float dark = 1.0 - clamp(dot(irradiance, vec3(0.3333)), 0.0, 1.0);
      vec3 shaded = c.rgb * mix(vec3(1.0), albedo, dark * ${hr.toFixed(3)}) * irradiance;
      float specular = pow(max(dot(n, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 60.0) * uSurface.y;
      if (uCel == 1) specular = smoothstep(0.3, 0.35, specular) * uSurface.y;
      vec2 side = length(n.xy) > 0.001 ? normalize(n.xy) : vec2(0.0);
      float rim = pow(1.0 - max(n.z, 0.0), 4.0) * smoothstep(-0.2, 0.7, dot(side, normalize(toLight + vec2(1e-4)))) * uSurface.z;
      shaded += radiance * (specular * max(0.0, ndl) + rim) * c.a;
      // Strength blends between the original painting and the relit result; alpha is unchanged.
      c.rgb = clamp(mix(c.rgb, shaded, uLighting.x), vec3(0.0), vec3(c.a));
      outColor = c * uAlpha;`), m = `#version 300 es
  in vec2 aPos; uniform vec2 uScale; uniform vec2 uOffset;
  void main() { gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0); gl_PointSize = 7.0; }`, l = `#version 300 es
  precision mediump float; uniform vec4 uColor; out vec4 o; void main() { o = uColor; }`;
  function c(g, b, a) {
    const d = g.createProgram();
    for (const [A, L] of [[g.VERTEX_SHADER, b], [g.FRAGMENT_SHADER, a]]) {
      const z = g.createShader(A);
      if (g.shaderSource(z, L), g.compileShader(z), !g.getShaderParameter(z, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(z));
      g.attachShader(d, z), g.deleteShader(z);
    }
    if (g.bindAttribLocation(d, 0, "aPos"), g.bindAttribLocation(d, 1, "aUv"), g.bindAttribLocation(d, 2, "aHeadWeight"), g.linkProgram(d), !g.getProgramParameter(d, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(d));
    const x = {}, w = g.getProgramParameter(d, g.ACTIVE_UNIFORMS);
    for (let A = 0; A < w; A++) {
      const L = g.getActiveUniform(d, A).name.replace("[0]", "");
      x[L] = g.getUniformLocation(d, L);
    }
    return { prog: d, u: x };
  }
  function f(g, b, a, d) {
    const x = [g];
    let w = g;
    for (; w < g + b - 0.5; ) {
      const A = d && w >= d.from && w < d.to ? d.cell : a;
      w = Math.min(g + b, w + A), x.push(w);
    }
    return x;
  }
  function h(g, b, a, d, x = null) {
    const [w, A, L, z] = g, Y = f(w, L, b, x && { from: x.x0, to: x.x1, cell: x.cell }), I = f(A, z, b, x && { from: x.y0, to: x.y1, cell: x.cell }), U = Y.length - 1, T = I.length - 1, F = (U + 1) * (T + 1), j = new Float32Array(F * 2), C = new Float32Array(F * 2);
    for (let Q = 0; Q <= T; Q++) for (let J = 0; J <= U; J++) {
      const X = Q * (U + 1) + J;
      j[X * 2] = Y[J], j[X * 2 + 1] = I[Q], C[X * 2] = (Y[J] - w) / L, C[X * 2 + 1] = (I[Q] - A) / z;
    }
    const B = [], H = [], N = a.length / d, ne = d === 1 ? 0 : 1;
    for (let Q = 0; Q < T; Q++) for (let J = 0; J < U; J++) {
      const X = Math.floor(Y[J] - w) * ne - 2, G = Math.ceil(Y[J + 1] - w) * ne + 2, re = Math.floor(I[Q] - A) * ne - 2, W = Math.ceil(I[Q + 1] - A) * ne + 2;
      let te = !1;
      for (let O = Math.max(0, re); O < Math.min(N, W) && !te; O += 1)
        for (let k = Math.max(0, X); k < Math.min(d, G); k += 1)
          if (a[O * d + k] > 3) {
            te = !0;
            break;
          }
      if (!te) continue;
      const ae = Q * (U + 1) + J, V = ae + 1, M = ae + U + 1, E = M + 1;
      B.push(ae, V, M, V, E, M), H.push(ae, V, ae, M, V, M), J === U - 1 && H.push(V, E), Q === T - 1 && H.push(M, E);
    }
    return { rect: g, cols: U, rows: T, rest: j, uv: C, pos: new Float32Array(j), tris: new Uint32Array(B), lines: new Uint32Array(H) };
  }
  class p {
    // padTop / padSide: margin around the image, as a share of its height / width. A negative
    // padTop pushes the top of the image above the canvas (hides a cut-off top edge).
    constructor(b, { padTop: a = 0, padSide: d = 0, fit: x = "contain" } = {}) {
      this.pad = { top: a, side: d }, this.fit = x;
      const w = b.getContext("webgl2", { premultipliedAlpha: !0, antialias: !0, alpha: !0, preserveDrawingBuffer: !0 });
      if (!w) throw new Error("WebGL2 is not available");
      this.gl = w, this.canvas = b, this.main = c(w, i, u), this.line = c(w, m, l), this.layers = [], this.lighting = et, this.lightingStats = { normalMs: 0, computedLayers: 0, cachedLayers: 0 }, w.enable(w.BLEND), w.blendFunc(w.ONE, w.ONE_MINUS_SRC_ALPHA);
    }
    texture(b) {
      const a = this.gl, d = a.createTexture();
      return a.bindTexture(a.TEXTURE_2D, d), a.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !0), a.texImage2D(a.TEXTURE_2D, 0, a.RGBA, a.RGBA, a.UNSIGNED_BYTE, b), a.generateMipmap(a.TEXTURE_2D), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_MIN_FILTER, a.LINEAR_MIPMAP_LINEAR), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_MAG_FILTER, a.LINEAR), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_WRAP_S, a.CLAMP_TO_EDGE), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_WRAP_T, a.CLAMP_TO_EDGE), d;
    }
    addLayer(b, a, d, x = {}) {
      const w = this.gl, A = w.createVertexArray();
      w.bindVertexArray(A);
      const L = w.createBuffer();
      w.bindBuffer(w.ARRAY_BUFFER, L), w.bufferData(w.ARRAY_BUFFER, d.pos, w.DYNAMIC_DRAW);
      for (const F of [this.main, this.line]) {
        const j = w.getAttribLocation(F.prog, "aPos");
        w.enableVertexAttribArray(j), w.vertexAttribPointer(j, 2, w.FLOAT, !1, 0, 0);
      }
      const z = w.createBuffer();
      w.bindBuffer(w.ARRAY_BUFFER, z), w.bufferData(w.ARRAY_BUFFER, d.uv, w.STATIC_DRAW);
      const Y = w.getAttribLocation(this.main.prog, "aUv");
      w.enableVertexAttribArray(Y), w.vertexAttribPointer(Y, 2, w.FLOAT, !1, 0, 0);
      const I = w.createBuffer();
      w.bindBuffer(w.ELEMENT_ARRAY_BUFFER, I), w.bufferData(w.ELEMENT_ARRAY_BUFFER, d.tris, w.STATIC_DRAW), w.bindVertexArray(null);
      const U = w.createBuffer();
      w.bindBuffer(w.ELEMENT_ARRAY_BUFFER, U), w.bufferData(w.ELEMENT_ARRAY_BUFFER, d.lines, w.STATIC_DRAW);
      const T = { name: b, image: a, mesh: d, tex: this.texture(a), vao: A, posBuf: L, uvBuf: z, triBuf: I, lineBuf: U, visible: !0, face: !!x.face, eyeBall: x.eyeBall, color: x.color || [1, 1, 1, 1] };
      return this.layers.push(T), T;
    }
    destroy() {
      const b = this.gl;
      for (const a of this.layers) {
        b.deleteTexture(a.tex), a.normal && b.deleteTexture(a.normal), a.headBuf && b.deleteBuffer(a.headBuf), b.deleteVertexArray(a.vao);
        for (const d of [a.posBuf, a.uvBuf, a.triBuf, a.lineBuf]) b.deleteBuffer(d);
      }
      b.deleteProgram(this.main.prog), b.deleteProgram(this.line.prog), this.lit && b.deleteProgram(this.lit.prog), this.shadow?.destroy(), this.layers.length = 0;
    }
    setLighting(b) {
      if (this.lighting = lr({ ...et, ...b }) ?? et, !this.lighting.enabled) return;
      const a = this.gl;
      this.lit || (this.lit = c(a, y, v));
      for (const d of this.layers) {
        if (d.normal || d.overlay) continue;
        const x = ar(d.image, d.mesh.rect, t, !/^(eye|mouth)/.test(d.name));
        this.lightingStats.normalMs += x.ms, this.lightingStats[x.computed ? "computedLayers" : "cachedLayers"]++, d.normal = a.createTexture(), a.activeTexture(a.TEXTURE0), a.bindTexture(a.TEXTURE_2D, d.normal), a.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), a.texImage2D(a.TEXTURE_2D, 0, a.RGBA, x.width, x.height, 0, a.RGBA, a.UNSIGNED_BYTE, x.data), a.generateMipmap(a.TEXTURE_2D), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_MIN_FILTER, a.LINEAR_MIPMAP_LINEAR), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_MAG_FILTER, a.LINEAR), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_WRAP_S, a.CLAMP_TO_EDGE), a.texParameteri(a.TEXTURE_2D, a.TEXTURE_WRAP_T, a.CLAMP_TO_EDGE);
        const w = new Float32Array(d.mesh.rest.length / 2);
        for (let A = 0; A < w.length; A++) w[A] = e.headWeight(d.mesh.rest[A * 2], d.mesh.rest[A * 2 + 1]);
        d.headBuf = a.createBuffer(), a.bindVertexArray(d.vao), a.bindBuffer(a.ARRAY_BUFFER, d.headBuf), a.bufferData(a.ARRAY_BUFFER, w, a.STATIC_DRAW), a.enableVertexAttribArray(2), a.vertexAttribPointer(2, 1, a.FLOAT, !1, 0, 0);
      }
      a.bindVertexArray(null), this.lighting.shadow && !this.shadow && (this.shadow = new pr(a, c));
    }
    resize() {
      const b = this.canvas, a = Math.min(window.devicePixelRatio || 1, 2), d = Math.round(b.clientWidth * a), x = Math.round(b.clientHeight * a);
      (b.width !== d || b.height !== x) && (b.width = d, b.height = x);
      const w = (this.fit === "cover" ? Math.max : Math.min)(d / (n.w * (1 + 2 * this.pad.side)), x / (n.h * (1 + this.pad.top))), A = (d - n.w * w) / 2, L = (x - n.h * w) / (this.fit === "cover" ? 2 : 1);
      this.scale = [2 * w / d, -2 * w / x], this.offset = [-1 + 2 * A / d, 1 - 2 * L / x], this.pxScale = w, this.pxOff = [A, L];
    }
    draw(b) {
      const a = this.gl;
      this.resize(), a.viewport(0, 0, this.canvas.width, this.canvas.height), a.clearColor(0, 0, 0, 0), a.clear(a.COLOR_BUFFER_BIT);
      const d = this.lighting.enabled, x = d && this.lighting.shadow;
      x && this.shadow.begin(this.canvas.width, this.canvas.height);
      const w = d ? this.lit : this.main;
      if (this.current = w, a.useProgram(w.prog), d) {
        const A = this.lighting;
        a.uniform1i(w.u.uNormal, 1), a.uniform3f(w.u.uLight, A.x, A.y, A.z), a.uniform3f(w.u.uLightColor, (A.color >> 16 & 255) / 255, (A.color >> 8 & 255) / 255, (A.color & 255) / 255), a.uniform3f(w.u.uAmbientColor, (A.ambientColor >> 16 & 255) / 255, (A.ambientColor >> 8 & 255) / 255, (A.ambientColor & 255) / 255), a.uniform4f(w.u.uLighting, A.strength, A.intensity, A.ambient, A.reach), a.uniform4f(w.u.uSurface, A.softness, A.specular, A.rim, A.detail), a.uniform1f(w.u.uAspect, this.canvas.width / this.canvas.height), a.uniform1i(w.u.uCel, A.mode === "cel" ? 1 : 0), a.uniformMatrix3fv(w.u.uHeadRotation, !1, mr(b.angleX ?? 0, b.angleY ?? 0, b.angleZ ?? 0, t.head.maxRoll));
      }
      a.uniform2fv(w.u.uScale, this.scale), a.uniform2fv(w.u.uOffset, this.offset), a.uniform1i(w.u.uTex, 0), a.uniform4fv(w.u.uEyeBox, r.flatMap((A) => [A.x0, A.x1, 0, 0])), a.uniform1fv(w.u.uEyeTop, r.flatMap((A) => A.top)), a.uniform1fv(w.u.uEyeBot, r.flatMap((A) => A.bot)), a.uniform4fv(w.u.uEyeState, b.eyes), a.uniform4f(w.u.uMouth, o.cx, o.cy, o.angle, o.halfLen), a.uniform4f(w.u.uMouthState, b.mouthOpen, b.mouthForm, o.bow, 0), a.uniform4f(w.u.uCheeks, s[0][0], s[0][1], s[1][0], s[1][1]), a.uniform1f(w.u.uCheek, b.cheek), a.activeTexture(a.TEXTURE0);
      for (const A of this.layers)
        !A.visible || A.overlay || this.drawLayer(A, A.alpha ?? 1);
      if (this.original && b.originalAlpha > 0 && this.drawLayer(this.original, b.originalAlpha), x && this.shadow.composite(this.lighting), b.showMesh) {
        const A = this.line;
        a.useProgram(A.prog), a.uniform2fv(A.u.uScale, this.scale), a.uniform2fv(A.u.uOffset, this.offset);
        for (const L of this.layers)
          !L.visible || L.overlay || (a.bindVertexArray(L.vao), a.bindBuffer(a.ELEMENT_ARRAY_BUFFER, L.lineBuf), a.uniform4fv(A.u.uColor, L.color), a.drawElements(a.LINES, L.mesh.lines.length, a.UNSIGNED_INT, 0), a.bindBuffer(a.ELEMENT_ARRAY_BUFFER, L.triBuf));
        b.joints?.length && this.drawPoints(b.joints), a.bindVertexArray(null);
      }
    }
    drawLayer(b, a) {
      const d = this.gl, x = this.current;
      d.useProgram(x.prog), d.bindVertexArray(b.vao), d.bindBuffer(d.ARRAY_BUFFER, b.posBuf), d.bufferSubData(d.ARRAY_BUFFER, 0, b.mesh.pos), this.lighting.enabled && (d.activeTexture(d.TEXTURE1), d.bindTexture(d.TEXTURE_2D, b.normal), d.activeTexture(d.TEXTURE0)), d.bindTexture(d.TEXTURE_2D, b.tex), d.uniform4fv(x.u.uRect, b.mesh.rect), d.uniform1i(x.u.uFace, b.eyeBall !== void 0 ? 2 + b.eyeBall : b.face ? 1 : 0), d.uniform1f(x.u.uAlpha, a), d.drawElements(d.TRIANGLES, b.mesh.tris.length, d.UNSIGNED_INT, 0);
    }
    drawPoints(b) {
      const a = this.gl, d = this.line;
      if (!this.pointBuf) {
        this.pointBuf = a.createBuffer(), this.pointVao = a.createVertexArray(), a.bindVertexArray(this.pointVao), a.bindBuffer(a.ARRAY_BUFFER, this.pointBuf);
        const x = a.getAttribLocation(d.prog, "aPos");
        a.enableVertexAttribArray(x), a.vertexAttribPointer(x, 2, a.FLOAT, !1, 0, 0);
      }
      a.bindVertexArray(this.pointVao), a.bindBuffer(a.ARRAY_BUFFER, this.pointBuf), a.bufferData(a.ARRAY_BUFFER, new Float32Array(b.flat()), a.DYNAMIC_DRAW), a.uniform4f(d.u.uColor, 1, 0.85, 0.2, 1), a.drawArrays(a.POINTS, 0, b.length);
    }
    // canvas CSS px -> source image px
    toImage(b, a) {
      if (!this.pxOff) return null;
      const d = this.canvas.width / this.canvas.clientWidth;
      return [(b * d - this.pxOff[0]) / this.pxScale, (a * d - this.pxOff[1]) / this.pxScale];
    }
  }
  return { Renderer: p, buildGrid: h };
}
function gr(e, t) {
  const { applyHead: n, applyBody: r, TASSELS: o, tasselAnchor: s } = e, i = (t.strands ?? []).map((a) => {
    if (a.nodes.length === 4) return a;
    const d = Array.from({ length: 4 }, (x, w) => {
      const A = w / 3 * (a.nodes.length - 1), L = Math.min(a.nodes.length - 2, Math.floor(A)), z = A - L;
      return [0, 1].map((Y) => a.nodes[L][Y] + (a.nodes[L + 1][Y] - a.nodes[L][Y]) * z);
    });
    return { ...a, nodes: d };
  }), u = [0, 300, 200, 140], y = 0.9, v = 7, m = { stiff: 1.7, damp: 1.6, couple: 0.85, reach: 0.9, bind: 4 }, l = Math.min(6, i.filter((a) => a.name.startsWith("bang")).length), c = { freq: 0.7, zeta: 0.22, hang: 0.85, inertia: 0.32, wind: 0.03, max: 0.55, smooth: 6 }, f = (a, d) => [a[0] * Math.cos(d) - a[1] * Math.sin(d), a[0] * Math.sin(d) + a[1] * Math.cos(d)], h = (a, d) => {
    const x = Math.hypot(a[0], a[1]);
    if (x < 1e-6) return a;
    const w = d * Math.tanh(x / d) / x;
    return [a[0] * w, a[1] * w];
  }, p = Object.fromEntries(Object.entries(t.buns ?? {}).map(([a, d]) => [a, { at: [d.cx, d.cy], k: 260, c: 11, hang: 3, max: 4 }])), g = (a, d) => {
    const x = Math.hypot(a[0], a[1]);
    x > d && (a[0] *= d / x, a[1] *= d / x);
  };
  class b {
    constructor() {
      this.gain = 1, this.out = { gain: 1, bunL: [0, 0], bunR: [0, 0] }, this.hair = {};
      for (const d of Object.keys(p))
        this.hair[d] = { p: null, v: [0, 0] }, this.out[d] = [0, 0];
      this.strands = i.map(() => ({ p: null, v: [[0, 0], [0, 0], [0, 0], [0, 0]] })), this.out.strands = i.map(() => [[0, 0], [0, 0], [0, 0], [0, 0]]), this.chains = o.map((d) => {
        const x = d.tip[0] - d.pivot[0], w = d.tip[1] - d.pivot[1], A = Math.hypot(x, w), L = [x / A, w / A];
        return { t: d, dir: L, L1: A * d.split, L2: A * (1 - d.split), pts: null, prev: null, phi: [0, 0], anchor: [0, 0] };
      }), this.time = 0;
    }
    hairAnchor(d, x) {
      const w = [d[0], d[1]];
      return n(w, 1, x), r(w, d[1], x), w;
    }
    step(d, x) {
      e.stepBody?.(d, x);
      const w = Math.max(1, Math.ceil(x / (1 / 240))), A = Math.min(x, 0.05) / w, L = -d.angleZ / 30 * t.head.maxRoll - d.bodyAngleZ / 10 * t.body.maxRoll, z = this.gain;
      i.forEach((I, U) => {
        const T = this.strands[U], F = this.out.strands[U], j = I.nodes.map((B) => this.hairAnchor(B, d));
        T.p || (T.p = j.map((B) => [...B]));
        const C = U * 1.7;
        for (let B = 0; B < w; B++) {
          const H = this.time + B * A;
          for (let N = 1; N < 4; N++) {
            const ne = Math.hypot(I.nodes[N][0] - I.nodes[0][0], I.nodes[N][1] - I.nodes[0][1]), Q = (Math.sin(H * 1.3) * 0.5 + Math.sin(H * 3.1) * 0.3 + Math.sin(H * 4.7 + C) * 0.2) * I.max * 0.1 * N / 3, J = [T.p[N - 1][0] - j[N - 1][0], T.p[N - 1][1] - j[N - 1][1]], X = j[N][0] + J[0] * y * m.couple - Math.sin(L) * ne * 0.12 + Q, G = j[N][1] + J[1] * y * m.couple, re = u[N] * I.k * m.stiff / Math.max(0.35, z), W = v * m.damp * Math.sqrt(m.stiff) / Math.max(0.5, Math.sqrt(z)), te = T.v[N], ae = T.p[N];
            te[0] += (re * (X - ae[0]) - W * te[0]) * A, te[1] += (re * (G - ae[1]) - W * te[1]) * A, ae[0] += te[0] * A, ae[1] += te[1] * A;
          }
          T.p[0] = [...j[0]];
        }
        for (let B = 0; B < 4; B++) {
          const H = [T.p[B][0] - j[B][0], T.p[B][1] - j[B][1]];
          F[B] = h(H, Math.max(0.5, I.max * m.reach * Math.max(1, z) * B / 3));
        }
      });
      for (const [I, U] of Object.entries(p)) {
        const T = this.hair[I], F = this.hairAnchor(U.at, d), j = Math.sin(this.time * 1.3 + U.at[0] * 0.01) * 0.6 + Math.sin(this.time * 2.9 + U.at[1] * 0.02) * 0.4, C = F[0] - Math.sin(L) * U.hang + j * U.max * 0.12, B = F[1];
        T.p || (T.p = [C, B]);
        const H = U.k / Math.max(0.35, z), N = U.c / Math.max(0.5, Math.sqrt(z));
        for (let Q = 0; Q < w; Q++)
          T.v[0] += (H * (C - T.p[0]) - N * T.v[0]) * A, T.v[1] += (H * (B - T.p[1]) - N * T.v[1]) * A, T.p[0] += T.v[0] * A, T.p[1] += T.v[1] * A;
        const ne = [T.p[0] - F[0], T.p[1] - F[1]];
        g(ne, U.max * Math.max(1, z)), this.out[I] = ne;
      }
      this.out.gain = 1;
      const Y = this.out.strands;
      for (let I = 0; I < m.bind; I++) for (let U = 1; U < 4; U++) {
        const T = Y.slice(0, l).map((F) => [...F[U]]);
        for (let F = 0; F < l; F++) {
          const j = T[Math.max(0, F - 1)], C = T[Math.min(l - 1, F + 1)];
          for (const B of [0, 1]) Y[F][U][B] = T[F][B] * 0.5 + (j[B] + C[B]) * 0.25;
        }
      }
      for (const I of this.chains) {
        const U = s(I.t, d, this.out, [0, 0]);
        I.st || (I.st = { th: [0, 0], w: [0, 0], pos: [...U], vel: [0, 0], acc: [0, 0] });
        const T = I.st, F = c, j = [(U[0] - T.pos[0]) / Math.max(x, 1e-3), (U[1] - T.pos[1]) / Math.max(x, 1e-3)], C = 1 - Math.exp(-x * F.smooth), B = [(j[0] - T.vel[0]) / Math.max(x, 1e-3), (j[1] - T.vel[1]) / Math.max(x, 1e-3)];
        T.acc = [T.acc[0] + (B[0] - T.acc[0]) * C, T.acc[1] + (B[1] - T.acc[1]) * C], T.vel = [T.vel[0] + (j[0] - T.vel[0]) * C, T.vel[1] + (j[1] - T.vel[1]) * C], T.pos = [...U];
        const H = [-I.dir[1], I.dir[0]], N = -(T.acc[0] * H[0] + T.acc[1] * H[1]) / (I.L1 + I.L2) * F.inertia, ne = (Math.sin(this.time * 0.9 + I.t.pivot[0]) * 0.6 + Math.sin(this.time * 0.37 + I.t.pivot[1]) * 0.4) * F.wind, Q = -L * F.hang + ne, J = 2 * Math.PI * F.freq / Math.sqrt(Math.max(0.4, z)), X = J * 1.35;
        for (let te = 0; te < w; te++) {
          const ae = -J * J * (T.th[0] - Q) - 2 * F.zeta * J * T.w[0] + N;
          T.w[0] += ae * A, T.th[0] += T.w[0] * A;
          const V = -X * X * (T.th[1] - T.th[0]) - 2 * F.zeta * X * T.w[1] + N * 0.4 + ae * 0.5;
          T.w[1] += V * A, T.th[1] += T.w[1] * A;
        }
        T.th[0] = Math.max(-0.55, Math.min(F.max, T.th[0])), T.th[1] = Math.max(-0.55 * 1.4, Math.min(F.max * 1.4, T.th[1])), I.phi = [T.th[0], T.th[1]];
        const G = f(I.dir, T.th[0]), re = f(I.dir, T.th[1]), W = [U[0] + G[0] * I.L1, U[1] + G[1] * I.L1];
        I.pts = [[...U], W, [W[0] + re[0] * I.L2, W[1] + re[1] * I.L2]], I.anchor = U;
      }
      return this.time += x, this.out;
    }
  }
  return { Physics: b };
}
const _n = (e, t) => e.reduce((n, r, o) => n + r * t[o], 0);
function yr(e, t) {
  const n = t.length, r = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let u = 0; u <= i; u++) {
    let y = e[i][u];
    for (let v = 0; v < u; v++) y -= r[i][v] * r[u][v];
    r[i][u] = i === u ? Math.sqrt(Math.max(1e-18, y)) : y / r[u][u];
  }
  const o = [], s = [];
  for (let i = 0; i < n; i++) o[i] = (t[i] - _n(r[i].slice(0, i), o)) / r[i][i];
  for (let i = n - 1; i >= 0; i--) {
    let u = o[i];
    for (let y = i + 1; y < n; y++) u -= r[y][i] * s[y];
    s[i] = u / r[i][i];
  }
  return s;
}
function vr(e) {
  const t = e.map((o) => [...o]), n = t.length, r = t.map((o, s) => t.map((i, u) => +(s === u)));
  for (let o = 0; o < 100 * n * n; o++) {
    let s = 0, i = 1, u = 0;
    for (let h = 0; h < n; h++) for (let p = h + 1; p < n; p++) Math.abs(t[h][p]) > u && (u = Math.abs(t[h][p]), s = h, i = p);
    if (u < 1e-12) break;
    const y = 0.5 * Math.atan2(2 * t[s][i], t[i][i] - t[s][s]), v = Math.cos(y), m = Math.sin(y), l = t[s][s], c = t[i][i], f = t[s][i];
    for (let h = 0; h < n; h++) if (h !== s && h !== i) {
      const p = t[h][s], g = t[h][i];
      t[h][s] = t[s][h] = v * p - m * g, t[h][i] = t[i][h] = m * p + v * g;
    }
    t[s][s] = v * v * l - 2 * m * v * f + m * m * c, t[i][i] = m * m * l + 2 * m * v * f + v * v * c, t[s][i] = t[i][s] = 0;
    for (let h = 0; h < n; h++) {
      const p = r[h][s], g = r[h][i];
      r[h][s] = v * p - m * g, r[h][i] = m * p + v * g;
    }
  }
  return { values: t.map((o, s) => o[s]), vectors: r };
}
function br(e, t, n, r = 1) {
  const o = e.map((l, c) => e.slice(c).reduce((f, h) => f + h, 0)), s = e.map((l, c) => e.map((f, h) => o[Math.max(c, h)] * l * f)), i = e.map((l, c) => t * o[c] * l), u = i.map(Math.sqrt), y = vr(s.map((l, c) => l.map((f, h) => f / u[c] / u[h]))), v = y.values.indexOf(Math.max(...y.values)), m = e.map((l, c) => e.map((f, h) => u[c] * u[h] * y.values.reduce((p, g, b) => p + y.vectors[c][b] * y.vectors[h][b] * 2 * n * Math.sqrt(g) * (b === v ? 1 : r), 0)));
  return { lengths: e, mass: o, coefficient: s, stiffness: i, damping: m, frequencies: y.values.map((l) => 1 / Math.sqrt(l) / (2 * Math.PI)).sort((l, c) => l - c), angles: e.map(() => 0), velocities: e.map(() => 0) };
}
function Ft(e, t = e.angles, n = e.velocities) {
  let r = e.stiffness.reduce((o, s, i) => o + s * (1 - Math.cos(t[i])), 0);
  for (let o = 0; o < t.length; o++) for (let s = 0; s < t.length; s++) r += 0.5 * e.coefficient[o][s] * Math.cos(t[o] - t[s]) * n[o] * n[s];
  return r;
}
function wr(e, t, n = 0, r = 1) {
  const o = e.angles, s = e.velocities, i = e.coefficient.map((m, l) => m.map((c, f) => c * Math.cos(o[l] - o[f]))), u = o.map((m, l) => _n(i[l], s) + t * (-e.stiffness[l] * r * Math.sin(m) - n * e.mass[l] * e.lengths[l] * Math.cos(m) - e.coefficient[l].reduce((c, f, h) => c + f * Math.sin(m - o[h]) * s[h] * s[h], 0)));
  let y = yr(i.map((m, l) => m.map((c, f) => c + t * e.damping[l][f])), u), v = o.map((m, l) => m + t * y[l]);
  if (n === 0 && r === 1) {
    const m = Ft(e), l = Ft(e, v, y.map(() => 0)), c = Ft(e, v, y);
    if (c > m)
      if (l > m)
        v = [...o], y = s.map((f) => f * 0.999);
      else {
        const f = Math.sqrt(Math.max(0, (m - l) / Math.max(1e-30, c - l)));
        y = y.map((h) => h * f);
      }
  }
  e.angles = v, e.velocities = y;
}
const Fn = Object.freeze({
  responseGain: 1,
  swing: 1,
  stiffness: 1,
  damping: 1,
  follow: 0.85,
  cohesion: 3,
  wind: 0.05,
  max: 20
}), jn = Object.freeze({ tierGain: 1, highModeDamping: 1 });
function xr(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) throw new TypeError("Expected cloth tuning");
  for (const [t, n] of Object.entries(e)) {
    if (!Object.hasOwn(Fn, t) && !Object.hasOwn(jn, t)) throw new RangeError(`Unknown cloth tuning: ${t}`);
    if (typeof n != "number" || !Number.isFinite(n)) throw new RangeError(`${t}: expected a finite number`);
    if (["tierGain", "highModeDamping", "responseGain", "swing", "stiffness", "damping", "max"].includes(t) && n <= 0) throw new RangeError(`${t}: must be positive`);
    if (["follow", "wind"].includes(t) && (n < 0 || t === "follow" && n > 1)) throw new RangeError(`${t}: out of range`);
    if (t === "cohesion" && (!Number.isInteger(n) || n < 0 || n > 8)) throw new RangeError("cohesion: expected an integer from 0 to 8");
  }
}
function mn(e, t) {
  const n = [0];
  for (let o = 1; o < e.length; o++)
    n.push(n[o - 1] + Math.hypot(e[o][0] - e[o - 1][0], e[o][1] - e[o - 1][1]));
  const r = n.at(-1);
  return Array.from({ length: t }, (o, s) => {
    const i = r * s / (t - 1);
    let u = 1;
    for (; u < e.length - 1 && n[u] < i; ) u++;
    const y = (i - n[u - 1]) / Math.max(1e-9, n[u] - n[u - 1]);
    return [0, 1].map((v) => e[u - 1][v] + (e[u][v] - e[u - 1][v]) * y);
  });
}
function Mr(e, t) {
  const { baseWeights: n, deformBase: r } = e, o = { bounceHz: 2.6, zeta: 0.25 }, s = t.legs ? 0.8 / ((Math.hypot(...t.legs.left.ankle.map((c, f) => c - t.legs.left.hip[f])) + Math.hypot(...t.legs.right.ankle.map((c, f) => c - t.legs.right.hip[f]))) / 2) : 1.6 / t.image.height, i = 0.8, u = (t.cloth ?? []).map((c) => {
    const f = kn(c), h = f.custom ? f.cols : c.columns ?? 8, p = f.custom ? f.rows : c.rows ?? 5, g = mn(c.waist, h), b = mn(c.hem, h), a = new Float64Array(p * h * 2);
    for (let d = 0; d < p; d++) for (let x = 0; x < h; x++) {
      const w = d / (p - 1), A = (d * h + x) * 2;
      a[A] = g[x][0] + (b[x][0] - g[x][0]) * w, a[A + 1] = g[x][1] + (b[x][1] - g[x][1]) * w;
    }
    return f.custom && a.set(f.rest), {
      grid: f,
      pendulums: (
        /** @type {ReturnType<typeof pendulumSystem>[]} */
        []
      ),
      systemKey: null,
      c,
      gravity: 9.80665 / (c.scale === void 0 ? s : c.scale / 1e3),
      tuning: Object.fromEntries(Object.entries({ ...Fn, ...jn }).map(([d, x]) => [d, c[d] ?? x])),
      cols: h,
      rows: p,
      rest: a,
      top: f.custom ? f.top : g,
      weights: (f.custom ? f.top : g).map(([d, x]) => n(d, x, 0)),
      target: new Float64Array(a.length),
      previous: null,
      pivotVelocity: new Float64Array(h * 2),
      angle: new Float64Array(h),
      angularVelocity: new Float64Array(h),
      lowerAngle: new Float64Array(h),
      lowerAngularVelocity: new Float64Array(h),
      bounce: new Float64Array(h),
      bounceVelocity: new Float64Array(h),
      out: Float64Array.from(a),
      physicalOut: Float64Array.from(a),
      parent: null,
      parentLoc: null,
      meshes: []
    };
  }), y = Object.fromEntries(u.map((c) => [c.c.name, c]));
  function v(c, f, h) {
    let p = null;
    for (let g = 0; g < c.rows - 1; g++) for (let b = 0; b < c.cols - 1; b++) {
      const a = [(g * c.cols + b) * 2, (g * c.cols + b + 1) * 2, ((g + 1) * c.cols + b + 1) * 2, ((g + 1) * c.cols + b) * 2], [d, x, w, A, L, z, Y, I] = a.flatMap((j) => [c.rest[j], c.rest[j + 1]]);
      let U = 0.5, T = 0.5;
      for (let j = 0; j < 10; j++) {
        const C = d * (1 - U) * (1 - T) + w * U * (1 - T) + L * U * T + Y * (1 - U) * T - f, B = x * (1 - U) * (1 - T) + A * U * (1 - T) + z * U * T + I * (1 - U) * T - h, H = (w - d) * (1 - T) + (L - Y) * T, N = (A - x) * (1 - T) + (z - I) * T, ne = (Y - d) * (1 - U) + (L - w) * U, Q = (I - x) * (1 - U) + (z - A) * U, J = H * Q - N * ne;
        if (Math.abs(J) < 1e-9) break;
        U -= (C * Q - B * ne) / J, T -= (H * B - N * C) / J;
      }
      let F = Math.max(0, -U, U - 1) + Math.max(0, -T, T - 1);
      if (c.grid.custom) {
        const j = Math.max(0, Math.min(1, U)), C = Math.max(0, Math.min(1, T)), B = d * (1 - j) * (1 - C) + w * j * (1 - C) + L * j * C + Y * (1 - j) * C, H = x * (1 - j) * (1 - C) + A * j * (1 - C) + z * j * C + I * (1 - j) * C;
        F = Math.hypot(B - f, H - h);
      }
      (!p || F < p.miss) && (p = { q: a, s: U, t: T, miss: F });
    }
    if (p.s = Math.min(c.grid.custom ? 1 : 4, Math.max(c.grid.custom ? 0 : -3, p.s)), p.t = Math.min(c.grid.custom ? 1 : 4, Math.max(c.grid.custom ? 0 : -3, p.t)), c.grid.custom) {
      const g = [0, 0];
      m(c.rest, p, g), p.offset = [f - g[0], h - g[1]];
    }
    return p;
  }
  function m(c, f, h) {
    const { q: p, s: g, t: b } = f, a = [(1 - g) * (1 - b), g * (1 - b), g * b, (1 - g) * b];
    h[0] = f.offset?.[0] ?? 0, h[1] = f.offset?.[1] ?? 0;
    for (let d = 0; d < 4; d++)
      h[0] += c[p[d]] * a[d], h[1] += c[p[d] + 1] * a[d];
    return h;
  }
  for (const c of u) c.c.parent && (c.parent = y[c.c.parent], c.parentLoc = c.top.map(([f, h]) => v(c.parent, f, h)));
  class l {
    constructor() {
      this.gain = 1, this.time = 0;
    }
    setTuning(f, h) {
      if (xr(h), f !== null && !Object.hasOwn(y, f)) throw new RangeError(`Unknown cloth: ${f}`);
      for (const p of u) (f === null || p.c.name === f) && Object.assign(p.tuning, h);
    }
    /** Skin a layer mesh (rest/pos arrays in source px) to the named garment. */
    attach(f, h) {
      const p = y[f], g = [];
      for (let b = 0; b < h.rest.length; b += 2) g.push(v(p, h.rest[b], h.rest[b + 1]));
      p.meshes.push({ mesh: h, locs: g });
    }
    step(f, h, p) {
      if (h < 0) return;
      const g = Math.min(h, 0.05), b = Math.max(1, Math.ceil(g * 240)), a = g / b, d = [0, 0];
      for (const x of u) {
        const { cols: w, rows: A, rest: L, target: z, out: Y, angle: I, angularVelocity: U, lowerAngle: T, lowerAngularVelocity: F, bounce: j, bounceVelocity: C } = x, { stiffness: B, damping: H, max: N, swing: ne, follow: Q, cohesion: J, wind: X, responseGain: G, tierGain: re, highModeDamping: W } = x.tuning, te = this.gain * (G ?? 1), ae = new Float64Array(w * 2), V = new Float64Array(w * 2), M = new Float64Array(w * 2);
        for (let $ = 0; $ < w; $++) {
          x.parent ? m(x.parent.physicalOut, x.parentLoc[$], d) : r(x.top[$][0], x.top[$][1], x.weights[$], f, p, d), ae[$ * 2] = d[0], ae[$ * 2 + 1] = d[1], x.parent && m(x.parent.out, x.parentLoc[$], d), V[$ * 2] = d[0], V[$ * 2 + 1] = d[1];
          for (let Z = 0; Z < 2; Z++) {
            const _ = $ * 2 + Z, D = x.previous && g > 0 ? (ae[_] - x.previous[_]) / g : 0;
            M[_] = g > 0 ? (D - x.pivotVelocity[_]) / g : 0, x.pivotVelocity[_] = D;
          }
          for (let Z = 0; Z < A; Z++) {
            const _ = (Z * w + $) * 2;
            z[_] = L[_] + d[0] - x.top[$][0], z[_ + 1] = L[_ + 1] + d[1] - x.top[$][1];
          }
        }
        x.previous = ae;
        const E = ne * Math.sqrt(B), O = 2 * Math.PI * o.bounceHz;
        if (x.grid.custom) {
          const $ = `${E}:${H}:${W}`;
          if (x.systemKey !== $) {
            const ee = x.pendulums;
            x.pendulums = x.grid.lengths.map((oe, S) => {
              const R = x.grid.joints[S], P = br(R.slice(1).map((se, ie) => (se - R[ie]) * oe * i), x.gravity * E ** 2, o.zeta * H, W);
              return ee[S] && (P.angles = ee[S].angles, P.velocities = ee[S].velocities), P;
            }), x.systemKey = $;
          }
          const Z = Math.max(...x.pendulums.flatMap((ee) => ee.frequencies)), _ = Math.max(b, Math.ceil(g * Z * 32)), D = g / _;
          for (let ee = 0; ee < _; ee++) {
            const oe = this.time + (ee + 1) * D, S = (Math.sin(oe * 1.1) * 0.6 + Math.sin(oe * 2.3) * 0.4) * N * X;
            for (let R = 0; R < w; R++) {
              const P = M[R * 2 + 1], se = Math.max(x.gravity * 0.1, x.gravity - P), ie = Math.max(-8 * x.gravity, Math.min(8 * x.gravity, M[R * 2])) - se * S / x.grid.lengths[R];
              wr(x.pendulums[R], D, ie, se / x.gravity), C[R] += (-(O ** 2) * j[R] - 2 * O * C[R] - P * 0.15) * D, j[R] += C[R] * D;
            }
          }
          for (let ee = 0; g > 0 && ee < J; ee++) for (const oe of ["angles", "velocities"]) {
            const S = x.pendulums.map((R) => [...R[oe]]);
            x.pendulums.forEach((R, P) => {
              R[oe] = S[P].map((se, ie) => 0.5 * se + 0.25 * (S[Math.max(0, P - 1)][ie] + S[Math.min(w - 1, P + 1)][ie]));
            });
          }
          const q = (ee, oe, S, R = 1) => {
            for (let P = 0; P < w; P++) {
              const se = x.grid.joints[P], ie = x.grid.seams[P], pe = x.grid.lengths[P], be = N * 0.1 * Math.tanh(j[P] * S / (N * 0.1)), Me = 2 * Math.asin(Math.min(0.95, (N - Math.abs(be)) / (2 * pe))), Be = x.pendulums[P].angles[0], Ee = x.pendulums[P].angles.map((K) => {
                const ce = R === 1 ? K : Be + (K - Be) * R;
                return Me * Math.tanh(ce * S / Me);
              }), de = [Array.from(oe.slice(P * 2, P * 2 + 2))];
              for (let K = 0; K < Ee.length; K++) {
                const ce = qe(ie, se[K]), ue = qe(ie, se[K + 1]), ke = ue[0] - ce[0], Se = ue[1] - ce[1], ye = Ee[K];
                de.push([de[K][0] + ke * Math.cos(ye) + Se * Math.sin(ye), de[K][1] - ke * Math.sin(ye) + Se * Math.cos(ye)]);
              }
              for (let K = 0; K < A; K++) {
                const ce = x.grid.fractions[P][K];
                let ue = 0;
                for (; ue < Ee.length - 1 && ce > se[ue + 1] + 1e-9; ) ue++;
                const ke = qe(ie, se[ue]), Se = qe(ie, ce), ye = (ce - se[ue]) / (se[ue + 1] - se[ue]), Le = Ee[ue] * (1 - 0.1 * (1 - Q) * (1 - ye)), $e = Se[0] - ke[0], nt = Se[1] - ke[1], rt = (K * w + P) * 2;
                ee[rt] = de[ue][0] + $e * Math.cos(Le) + nt * Math.sin(Le), ee[rt + 1] = de[ue][1] - $e * Math.sin(Le) + nt * Math.cos(Le) + be * ce;
              }
            }
          };
          q(x.physicalOut, ae, 1), q(Y, V, te, re);
          continue;
        }
        for (let $ = 0; $ < b; $++) {
          const Z = this.time + ($ + 1) * a, _ = (Math.sin(Z * 1.1) * 0.6 + Math.sin(Z * 2.3) * 0.4) * N * X;
          for (let D = 0; D < w; D++) {
            const q = D * 2, ee = ((A - 1) * w + D) * 2, oe = Math.max(1, Math.hypot(L[ee] - L[q], L[ee + 1] - L[q + 1])), S = Math.max(x.gravity * 0.1, x.gravity - M[q + 1]), R = i * oe / 2, P = S / R * E * E, se = Math.sqrt(P), ie = o.zeta * H, pe = se * Math.sqrt(2 - Math.SQRT2), be = se * Math.sqrt(2 + Math.SQRT2), Me = 2 * ie * pe * be / (pe + be), Be = 2 * ie / (pe + be), Ee = I[D] - T[D], de = Math.cos(Ee), K = Math.sin(Ee), ce = U[D], ue = F[D], Se = (Math.max(-8 * x.gravity, Math.min(8 * x.gravity, M[q])) - S * _ / oe) / R, ye = Me * (2 * ce + de * ue) + Be * 2 * P * ce, Le = Me * (de * ce + ue) + Be * P * ue, $e = -2 * P * Math.sin(I[D]) - K * ue * ue - 2 * Se * Math.cos(I[D]) - ye, nt = -P * Math.sin(T[D]) + K * ce * ce - Se * Math.cos(T[D]) - Le, rt = 2 - de * de;
            U[D] += ($e - de * nt) / rt * a, F[D] += (2 * nt - de * $e) / rt * a, I[D] += U[D] * a, T[D] += F[D] * a, C[D] += (-O * O * j[D] - 2 * O * C[D] - M[q + 1] * 0.15) * a, j[D] += C[D] * a;
          }
        }
        for (let $ = 0; g > 0 && $ < J; $++) for (const Z of [I, U, T, F]) {
          const _ = Z.slice();
          for (let D = 0; D < w; D++) Z[D] = _[D] * 0.5 + (_[Math.max(0, D - 1)] + _[Math.min(w - 1, D + 1)]) * 0.25;
        }
        const k = ($, Z, _) => {
          for (let D = 0; D < w; D++) {
            const q = D * 2, ee = ((A - 1) * w + D) * 2, oe = Math.max(1, Math.hypot(L[ee] - L[q], L[ee + 1] - L[q + 1])), S = N * 0.1 * Math.tanh(j[D] * _ / (N * 0.1)), R = 2 * Math.asin(Math.min(0.95, (N - Math.abs(S)) / (2 * oe))), P = R * Math.tanh(I[D] * _ / R), se = R * Math.tanh(T[D] * _ / R), ie = 0.1 * (1 - Q), pe = (L[ee] - L[q]) / 2, be = (L[ee + 1] - L[q + 1]) / 2, Me = Z[q] + pe * Math.cos(P) + be * Math.sin(P), Be = Z[q + 1] - pe * Math.sin(P) + be * Math.cos(P);
            for (let Ee = 0; Ee < A; Ee++) {
              const de = Ee / (A - 1), K = (Ee * w + D) * 2, ce = de <= 0.5, ue = ce ? de * 2 : (de - 0.5) * 2, ke = (ce ? P : se) * (1 - ie + ie * ue), Se = Math.cos(ke), ye = Math.sin(ke), Le = pe * ue, $e = be * ue;
              $[K] = (ce ? Z[q] : Me) + Le * Se + $e * ye, $[K + 1] = (ce ? Z[q + 1] : Be) - Le * ye + $e * Se + S * de;
            }
          }
        };
        k(x.physicalOut, ae, 1), k(Y, V, te);
      }
      this.time += g;
    }
    deform() {
      const f = [0, 0];
      for (const h of u) for (const { mesh: p, locs: g } of h.meshes)
        for (let b = 0; b < g.length; b++)
          m(h.out, g[b], f), p.pos[b * 2] = f[0], p.pos[b * 2 + 1] = f[1];
    }
    /** Grid nodes per garment, for debug overlays. */
    get grids() {
      return u.map((f) => ({ name: f.c.name, cols: f.cols, rows: f.rows, nodes: f.out }));
    }
  }
  return { Cloth: l, garments: u };
}
function Ar(e, t) {
  const { baseWeights: n, deformBase: r, MOUTH: o } = e, s = (w, A, L) => {
    const z = Math.min(1, Math.max(0, (L - w) / (A - w)));
    return z * z * (3 - 2 * z);
  }, i = t.mouth.area, u = {
    a: { sprite: "mouth_a", ref: 0.9, width: 1 },
    aHalf: { sprite: "mouth_a_half", ref: 0.55, width: 1 },
    i: { sprite: "mouth_i", ref: 0.55, width: 1 },
    e: { sprite: "mouth_a_half", ref: 0.65, width: 1.06 },
    o: { sprite: "mouth_o", ref: 0.75, width: 1 },
    u: { sprite: "mouth_o", ref: 0.75, width: 0.78 }
  }, y = 0.16, v = ["angry", "sad"];
  function m(w, A) {
    const z = (U, T, F) => U >= T - (A ? 0.07 : 0) && U < F + (A ? 0.07 : 0), Y = [["i", -9, -0.55], ["e", -0.55, -0.2], ["a", -0.2, 0.35], ["o", 0.35, 0.75], ["u", 0.75, 9]], I = A && Y.find((U) => U[0] === A || A === "aHalf" && U[0] === "a");
    return I && z(w, I[1], I[2]) ? I[0] : Y.find((U) => w >= U[1] && w < U[2])[0];
  }
  const l = 0.75, c = 0.3, f = 0.06, h = ["sad", "surprise"];
  function p(w, A, L = null) {
    return L && w >= c ? L : w >= l ? null : w < c ? A >= 0.5 ? "eyes_smile" : "eyes_closed" : "eyes_half";
  }
  function g(w, A, L = null) {
    if (w < y) return null;
    const z = m(A, L);
    return z === "a" ? w >= 0.6 ? "a" : "aHalf" : z;
  }
  function b(w) {
    return o.cy + (w - o.cx) * Math.tan(o.angle);
  }
  function a() {
    return i.cx;
  }
  function d(w, A) {
    const L = Math.cos(-i.angle), z = Math.sin(-i.angle), Y = w - i.cx, I = A - i.cy, U = (Y * L - I * z) / i.rx, T = (Y * z + I * L) / i.ry;
    return 1 - s(0.55, 0.95, Math.hypot(U, T));
  }
  function x(w, A, L, z, Y) {
    const I = {}, U = (X) => X.startsWith("eyes_closed") || X.startsWith("eyes_smile"), T = (X) => v.some((G) => X === `mouth_${G}`), F = (X) => U(X) ? 1 : X.startsWith("eyes_") ? 0 : T(X) ? 2 : 3, j = Object.entries(A.layers).sort((X, G) => F(X[0]) - F(G[0]));
    for (const [X, G] of j) {
      const re = z(G, t.mesh.spriteCell, Y(L[X]), L[X].width), W = [], te = [];
      for (let V = 0; V < re.rest.length / 2; V++) {
        const M = re.rest[V * 2], E = re.rest[V * 2 + 1];
        W.push(n(M, E, 0)), te.push(X.startsWith("mouth") ? d(M, E) : 0);
      }
      const ae = w.addLayer(X, L[X], re, { color: [0.4, 1, 0.8, 0.6] });
      ae.visible = !1, I[X] = { mesh: re, W, inner: te, layer: ae };
    }
    const C = [0, 1].map((X) => !!(I[`eyes_closed_${X}`] && I[`eyes_half_${X}`])), B = Object.values(u).some((X) => I[X.sprite]), H = (X, G) => (X === "eyes_smile" && !I[`eyes_smile_${G}`] && (X = "eyes_closed"), X === "open" || I[`${X}_${G}`] ? X : "open"), N = [0, 0];
    let ne = null;
    const Q = [0, 1].map(() => ({ cur: "open", prev: "open", t: 1 }));
    function J(X, G, re, W, te = 1) {
      const ae = X.mesh.rest, V = X.mesh.pos;
      for (let M = 0; M < X.W.length; M++) {
        let E = ae[M * 2], O = ae[M * 2 + 1];
        const k = X.inner[M];
        if (k > 0) {
          const $ = b(E);
          O = $ + (O - $) * (1 + (W - 1) * k), E = a() + (E - a()) * (1 + (te - 1) * k);
        }
        r(E, O, X.W[M], G, re, N), V[M * 2] = N[0], V[M * 2 + 1] = N[1];
      }
    }
    return {
      /**
       * Show / hide and deform the sprites for this frame.
       * Returns which eyes are covered by a sprite, so the layered eye parts can be hidden, and
       * whether a drawing shows the mouth, so the shader mouth can be left out.
       * `mood` (angry / sad / surprise) picks drawn expression eyes (sad, surprise) and closed
       * mouths (angry, sad) when the avatar has them.
       */
      update(X, G, re = 1 / 60, W = null) {
        for (const k of Object.values(I)) k.layer.visible = !1;
        const te = [!1, !1];
        [
          [X.eyeROpen, X.eyeSmile],
          [X.eyeLOpen, X.eyeSmileL ?? X.eyeSmile]
        ].forEach(([k, $], Z) => {
          const _ = Q[Z], D = h.includes(W) && I[`eyes_${W}_${Z}`] ? `eyes_${W}` : null, q = H(p(k, $, D) ?? "open", Z);
          q !== _.cur && (_.prev = _.cur, _.cur = q, _.t = 0), _.t = re > 0 ? Math.min(1, _.t + re / f) : 1;
          const ee = s(0, 1, _.t), oe = (R, P) => {
            if (R === "open" || P <= 1e-3) return;
            const se = I[`${R}_${Z}`];
            se && (se.layer.visible = !0, se.layer.alpha = P, J(se, X, G, 1));
          }, S = (R) => R === "open" ? -1 : U(R) ? 1 : 0;
          _.t >= 1 ? oe(_.cur, 1) : S(_.cur) > S(_.prev) ? (oe(_.prev, 1), oe(_.cur, ee)) : (oe(_.cur, 1), oe(_.prev, 1 - ee)), te[Z] = _.cur !== "open" && ee >= 0.999;
        });
        const V = g(X.mouthOpen, X.mouthForm, ne);
        ne = V;
        const M = V && u[V], E = M && I[M.sprite], O = v.includes(W) && I[`mouth_${W}`];
        if (O && (!E || X.mouthOpen < y + 0.04) && (O.layer.visible = !0, O.layer.alpha = 1, J(O, X, G, 1)), E) {
          E.layer.visible = !0, E.layer.alpha = s(y, y + 0.04, X.mouthOpen);
          const k = Math.min(1.1, Math.max(0.5, X.mouthOpen / M.ref));
          J(E, X, G, k, M.width);
        }
        return { eyes: te, mouth: V, mouthDrawn: B && (!M || !!E) };
      },
      /** Whether each eye has the closed and half-closed drawings, so the layered eye stays open. */
      eyesDrawn: C
    };
  }
  return { createSprites: x, mouthShape: g, eyeSprite: p };
}
const pn = { angry: "angry", angryTalk: "angry", sad: "sad", sadTalk: "sad", surprise: "surprise", surprisedTalk: "surprise" };
function Er(e, t) {
  return e && e !== "neutral" ? pn[e] ?? null : (t && pn[t]) ?? null;
}
function Sr(e, t, n, r = 6) {
  let o = t, s = n, i = -1, u = -1;
  for (let m = 0; m < n; m++) {
    const l = m * t;
    for (let c = 0; c < t; c++)
      e[l + c] > 3 && (c < o && (o = c), c > i && (i = c), m < s && (s = m), m > u && (u = m));
  }
  if (i < 0) return null;
  const y = Math.max(0, o - r), v = Math.max(0, s - r);
  return [y, v, Math.min(t, i + 1 + r) - y, Math.min(n, u + 1 + r) - v];
}
function Or(e, t, n, r, o, s, i = 16, u, y, v) {
  const m = /* @__PURE__ */ new Map();
  for (const l of t.overlays) {
    const c = n[l.name];
    if (u !== void 0 && c.width !== u || y !== void 0 && c.height !== y)
      throw new Error(`overlay ${l.name}: image size does not match base.png`);
    const f = o(c), h = Sr(f, c.width, c.height);
    if (!h) continue;
    const [p, g, b, a] = h, d = new Uint8Array(b * a);
    for (let L = 0; L < a; L++) d.set(f.subarray((g + L) * c.width + p, (g + L) * c.width + p + b), L * b);
    const x = r(h, i, d, b), w = [];
    for (let L = 0; L < x.rest.length; L += 2) {
      const z = s(x.rest[L], x.rest[L + 1], 0);
      w.push({ ...z, brow: 0, jaw: 0 });
    }
    const A = e.addLayer(`overlay_${l.name}`, v(c, h), x);
    A.visible = !1, m.set(l.name, { mesh: x, weights: w, layer: A });
  }
  return {
    /** Shows the named overlays and hides the rest. Unknown names are ignored. */
    set(l) {
      const c = new Set(l);
      for (const [f, h] of m) h.layer.visible = c.has(f);
    },
    update(l, c, f, h) {
      for (const { mesh: p, weights: g, layer: b } of m.values())
        if (b.visible)
          for (let a = 0; a < g.length; a++)
            f(p.rest[a * 2], p.rest[a * 2 + 1], g[a], l, c, h), p.pos[a * 2] = h[0], p.pos[a * 2 + 1] = h[1];
    }
  };
}
function tn(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) throw new TypeError("lipSync: expected an object");
  const t = e, n = {};
  for (const r of ["granularity", "openness", "closeSpeed"]) {
    const o = t[r];
    if (o !== void 0) {
      if (typeof o != "number" || !Number.isFinite(o) || o < 0 || o > 1)
        throw new RangeError(`lipSync.${r}: expected 0–1`);
      n[r] = o;
    }
  }
  if (t.preset !== void 0) {
    if (!["calm", "default", "lively", "subtle", "big", "custom"].includes(t.preset))
      throw new RangeError("lipSync.preset: expected calm, default, lively, subtle, big or custom");
    n.preset = t.preset;
  }
  return n;
}
function dn(e = {}, t = {
  granularity: 0.5,
  openness: 0.5,
  closeSpeed: 0.5
}) {
  const n = tn(e);
  return {
    granularity: n.granularity ?? t.granularity,
    openness: n.openness ?? t.openness,
    closeSpeed: n.closeSpeed ?? t.closeSpeed
  };
}
const Pe = (e, t, n, r) => e === 0.5 ? n : e < 0.5 ? t + (n - t) * e * 2 : n + (r - n) * (e - 0.5) * 2;
function gn(e) {
  return {
    arm: Pe(e.granularity, 0.2, 0.6, 0.9),
    trigger: Pe(e.granularity, 0.65, 0.8, 0.95),
    relax: Pe(e.granularity, 1.5, 5, 12),
    range: Pe(e.granularity, 0.7, 0.3, 0.05),
    risePower: Pe(e.granularity, 0.05, 0.3, 0.8),
    openness: Pe(e.openness, 0.55, 1, 1.25),
    audioRelease: Pe(e.closeSpeed, 6, 32, 45),
    kanaRelease: Pe(e.closeSpeed, 6, 22, 45)
  };
}
const Tr = /* @__PURE__ */ new Set([
  "angleX",
  "angleY",
  "angleZ",
  "bodyAngleX",
  "bodyAngleZ",
  "armAngle",
  "handAngle",
  "gazeX",
  "gazeY"
]), nn = {
  nod: {
    label: "Nod",
    dur: 1.7,
    tracks: {
      angleY: [[0, 0], [0.32, -13], [0.62, 2], [0.95, -9], [1.3, 1], [1.7, 0]],
      angleZ: [[0, 0], [0.4, -2], [1, -1], [1.7, 0]],
      bodyAngleX: [[0, 0], [0.5, -1.5], [1.7, 0]],
      eyeSmile: [[0, 0], [0.3, 0.45], [1.3, 0.45], [1.7, 0]],
      eyeOpen: [[0, 1], [0.3, 0.72], [1.3, 0.72], [1.7, 1]],
      mouthOpen: [[0, 0], [0.3, 0.12], [1.3, 0.12], [1.7, 0]],
      mouthForm: [[0, 0], [0.3, -0.6], [1.7, -0.3]]
    }
  },
  tilt: {
    label: "Head tilt",
    dur: 2.6,
    tracks: {
      angleZ: [[0, 0], [0.55, 17], [2, 15], [2.6, 0]],
      angleX: [[0, 0], [0.6, 8], [2, 7], [2.6, 0]],
      angleY: [[0, 0], [0.6, 4], [2.6, 0]],
      bodyAngleZ: [[0, 0], [0.8, 3], [2, 3], [2.6, 0]],
      gazeX: [[0, 0], [0.4, 0.5], [2.1, 0.4], [2.6, 0]],
      gazeY: [[0, 0], [0.4, 0.35], [2.1, 0.3], [2.6, 0]],
      browAngle: [[0, 0], [0.5, -0.7], [2.1, -0.6], [2.6, 0]],
      browY: [[0, 0], [0.5, 0.35], [2.1, 0.3], [2.6, 0]]
      // closed mouth: a barely open round mouth read as a squashed blob
    }
  },
  think: {
    label: "Thinking",
    dur: 3.6,
    tracks: {
      angleX: [[0, 0], [0.7, -11], [3, -9], [3.6, 0]],
      angleY: [[0, 0], [0.7, 9], [3, 8], [3.6, 0]],
      angleZ: [[0, 0], [0.8, 6], [3, 5], [3.6, 0]],
      gazeX: [[0, 0], [0.35, -0.8], [3.1, -0.7], [3.6, 0]],
      gazeY: [[0, 0], [0.35, 0.7], [3.1, 0.6], [3.6, 0]],
      handAngle: [[0, 0], [0.6, 3], [3, 3], [3.6, 0]],
      fingerTap: [
        [0, 0],
        [0.9, 0],
        [1.05, 1],
        [1.2, 0],
        [1.4, 1],
        [1.55, 0],
        [1.75, 1],
        [1.9, 0],
        [2.3, 0],
        [2.45, 1],
        [2.6, 0],
        [3.6, 0]
      ],
      browY: [[0, 0], [0.6, 0.25], [3, 0.2], [3.6, 0]],
      browAngle: [[0, 0], [0.6, -0.3], [3, -0.3], [3.6, 0]],
      mouthForm: [[0, 0], [0.6, 0.4], [3.6, 0]]
    }
  },
  giggle: {
    label: "Chuckle",
    dur: 2.2,
    tracks: {
      eyeOpen: [[0, 1], [0.2, 0], [1.8, 0], [2.2, 1]],
      eyeSmile: [[0, 0], [0.2, 1], [1.8, 1], [2.2, 0]],
      mouthOpen: [[0, 0], [0.2, 0.5], [0.45, 0.32], [0.7, 0.55], [0.95, 0.34], [1.2, 0.5], [1.8, 0.3], [2.1, 0]],
      mouthForm: [[0, 0], [0.2, -0.8], [2.2, -0.2]],
      blush: [[0, 0], [0.3, 0.7], [1.8, 0.7], [2.2, 0.1]],
      angleY: [[0, 0], [0.2, -5], [0.45, -1], [0.7, -6], [0.95, -2], [1.2, -5], [1.6, -2], [2.2, 0]],
      angleZ: [[0, 0], [0.3, -6], [1.8, -5], [2.2, 0]],
      bodyAngleZ: [[0, 0], [0.25, 2], [0.5, -1], [0.75, 2], [1, -1], [1.3, 1.5], [2.2, 0]],
      browY: [[0, 0], [0.3, 0.3], [1.8, 0.3], [2.2, 0]]
    }
  },
  surprise: {
    label: "Surprise",
    dur: 2,
    tracks: {
      angleY: [[0, 0], [0.12, 10], [0.5, 6], [1.5, 5], [2, 0]],
      angleX: [[0, 0], [0.12, -4], [2, 0]],
      bodyAngleX: [[0, 0], [0.15, -4], [1.5, -3], [2, 0]],
      eyeOpen: [[0, 1], [0.1, 1.25], [1.5, 1.2], [2, 1]],
      browY: [[0, 0], [0.1, 1], [1.5, 0.9], [2, 0]],
      mouthOpen: [[0, 0], [0.12, 0.6], [1.4, 0.45], [2, 0]],
      mouthForm: [[0, 0], [0.12, 0.6], [1.5, 0.55], [2, 0]],
      // o
      armAngle: [[0, 0], [0.15, -4], [1.5, -3], [2, 0]]
    }
  },
  shy: {
    label: "Shy",
    dur: 3.2,
    tracks: {
      angleX: [[0, 0], [0.6, 14], [2.6, 12], [3.2, 0]],
      angleY: [[0, 0], [0.6, -9], [2.6, -8], [3.2, 0]],
      angleZ: [[0, 0], [0.7, -8], [2.6, -7], [3.2, 0]],
      gazeX: [[0, 0], [0.3, 0.8], [1.6, 0.8], [1.9, -0.3], [2.2, 0.8], [2.8, 0.6], [3.2, 0]],
      gazeY: [[0, 0], [0.3, -0.5], [2.8, -0.4], [3.2, 0]],
      eyeOpen: [[0, 1], [0.5, 0.75], [2.7, 0.75], [3.2, 1]],
      eyeSmile: [[0, 0], [0.5, 0.5], [2.7, 0.5], [3.2, 0]],
      blush: [[0, 0], [0.8, 1], [2.7, 1], [3.2, 0]],
      browAngle: [[0, 0], [0.5, -0.6], [2.7, -0.5], [3.2, 0]],
      mouthForm: [[0, 0], [0.5, -0.4], [3.2, 0]],
      handAngle: [[0, 0], [0.8, 4], [2.6, 4], [3.2, 0]]
    }
  },
  no: {
    label: "Shake head",
    dur: 1.9,
    tracks: {
      angleX: [[0, 0], [0.2, 13], [0.45, -13], [0.7, 12], [0.95, -10], [1.2, 5], [1.5, 0]],
      angleY: [[0, 0], [0.2, -3], [1.3, -3], [1.9, 0]],
      bodyAngleX: [[0, 0], [0.3, 1.5], [0.6, -1.5], [0.9, 1], [1.3, 0]],
      eyeOpen: [[0, 1], [0.15, 0], [1.4, 0], [1.9, 1]],
      eyeSmile: [[0, 0], [0.15, 1], [1.4, 1], [1.9, 0]],
      // closed mouth while shaking the head
      browAngle: [[0, 0], [0.2, -0.5], [1.4, -0.5], [1.9, 0]]
    }
  },
  wink: {
    label: "Wink",
    dur: 2,
    tracks: {
      angleZ: [[0, 0], [0.35, -13], [1.5, -12], [2, 0]],
      angleX: [[0, 0], [0.35, 9], [1.5, 8], [2, 0]],
      bodyAngleZ: [[0, 0], [0.5, -2], [1.5, -2], [2, 0]],
      eyeOpenL: [[0, 1], [0.25, 1], [0.4, 0], [1.4, 0], [1.6, 1]],
      eyeSmileL: [[0, 0], [0.3, 1], [1.5, 1], [1.7, 0]],
      mouthOpen: [[0, 0], [2, 0]],
      // wink with a closed smile
      mouthForm: [[0, 0], [0.35, -0.8], [2, 0]],
      blush: [[0, 0], [0.4, 0.5], [1.6, 0.5], [2, 0]]
    }
  },
  greet: {
    label: "Greeting",
    dur: 2.6,
    tracks: {
      angleY: [[0, 0], [0.7, -18], [1.2, -17], [1.9, 2], [2.6, 0]],
      bodyAngleX: [[0, 0], [0.8, 2], [1.8, 0]],
      bodyAngleZ: [[0, 0], [0.8, 1.5], [2, 0]],
      armAngle: [[0, 0], [0.8, 3], [2, 0]],
      eyeOpen: [[0, 1], [0.5, 0], [1.4, 0], [1.8, 1]],
      eyeSmile: [[0, 0], [0.5, 1], [1.6, 1], [2.3, 0.4], [2.6, 0]],
      mouthOpen: [[0, 0], [1.6, 0], [1.8, 0.3], [2.3, 0.2], [2.6, 0]],
      mouthForm: [[0, 0], [1.6, -0.8], [2.6, -0.3]],
      blush: [[0, 0], [1.6, 0.3], [2.6, 0]]
    }
  }
}, rn = {
  lookAround: {
    label: "Look around",
    dur: 5.2,
    idle: !0,
    tracks: {
      gazeX: [[0, 0], [0.25, -0.85], [1.5, -0.8], [1.8, 0.1], [2.1, 0.85], [3.4, 0.8], [3.7, 0], [5.2, 0]],
      gazeY: [[0, 0], [0.25, 0.15], [1.8, 0.25], [2.1, 0.1], [3.7, 0], [5.2, 0]],
      angleX: [[0, 0], [0.7, -20], [1.6, -18], [2.5, 19], [3.5, 17], [4.4, 0], [5.2, 0]],
      angleY: [[0, 0], [0.7, 3], [1.8, 5], [2.5, 3], [4.4, 0]],
      angleZ: [[0, 0], [0.8, 4], [1.8, 0], [2.6, -4], [4.4, 0]],
      bodyAngleX: [[0, 0], [1, -4], [2.8, 4], [4.6, 0]],
      bodyAngleZ: [[0, 0], [1, 1.5], [2.8, -1.5], [4.6, 0]],
      handAngle: [[0, 0], [1, -2], [2.8, 2], [4.6, 0]],
      browY: [[0, 0], [0.5, 0.35], [3.6, 0.3], [4.4, 0]],
      // curious: a quick inhale, held while looking, let out at the end
      breath: [[0, 0.2], [0.6, 0.85], [3.6, 0.7], [4.6, 0], [5.2, 0.1]]
    }
  },
  glance: {
    label: "Side glance",
    dur: 4.6,
    idle: !0,
    tracks: {
      gazeX: [[0, 0], [0.18, 0.9], [2.6, 0.85], [2.9, 0.15], [3.2, 0], [4.6, 0]],
      gazeY: [[0, 0], [0.18, 0.4], [2.6, 0.35], [3.2, 0]],
      angleX: [[0, 0], [0.6, 13], [2.6, 11], [3.6, 0]],
      angleY: [[0, 0], [0.6, 6], [2.6, 5], [3.6, 0]],
      angleZ: [[0, 0], [0.7, -5], [2.6, -4], [3.6, 0]],
      bodyAngleX: [[0, 0], [1, 2.5], [2.8, 2], [4, 0]],
      eyeOpen: [[0, 1], [0.3, 1.06], [2.5, 1.05], [2.8, 0.85], [3.4, 1]],
      browY: [[0, 0], [0.4, 0.4], [2.5, 0.35], [3.4, 0]],
      browAngle: [[0, 0], [0.4, -0.2], [2.5, -0.2], [3.4, 0]],
      breath: [[0, 0], [0.5, 0.6], [2.6, 0.55], [3.8, 0], [4.6, 0.3]]
    }
  },
  sway: {
    label: "Sway",
    dur: 7,
    idle: !0,
    tracks: {
      bodyAngleZ: [[0, 0], [1.6, 6], [3.4, -6], [5.2, 5], [7, 0]],
      bodyAngleX: [[0, 0], [1.6, 3], [3.4, -3], [5.2, 2.5], [7, 0]],
      angleZ: [[0, 0], [1.8, -10], [3.6, 10], [5.4, -8], [7, 0]],
      angleX: [[0, 0], [1.8, 6], [3.6, -6], [5.4, 5], [7, 0]],
      angleY: [[0, 0], [0.9, 3], [1.8, 0], [2.7, 3], [3.6, 0], [4.5, 3], [5.4, 0], [7, 0]],
      armAngle: [[0, 0], [1.6, 3], [3.4, -3], [5.2, 2], [7, 0]],
      handAngle: [[0, 0], [1.8, -4], [3.6, 4], [5.4, -3], [7, 0]],
      gazeX: [[0, 0], [1.8, -0.3], [3.6, 0.3], [5.4, -0.2], [7, 0]],
      eyeOpen: [[0, 1], [0.8, 0.82], [6.2, 0.82], [7, 1]],
      eyeSmile: [[0, 0], [0.8, 0.35], [6.2, 0.35], [7, 0]],
      // slow, even breaths in time with the sway
      breath: [[0, 0], [0.9, 1], [1.8, 0], [2.7, 1], [3.6, 0], [4.5, 1], [5.4, 0], [6.3, 0.8], [7, 0]]
    }
  },
  sigh: {
    label: "Sigh",
    dur: 5.6,
    idle: !0,
    tracks: {
      breath: [[0, 0], [1.3, 1.25], [1.9, 1.25], [3.6, 0], [5.6, 0]],
      angleY: [[0, 0], [1.3, 9], [1.9, 9], [3.3, -9], [4.6, -6], [5.6, 0]],
      angleZ: [[0, 0], [1.3, -3], [3.3, 5], [5.6, 0]],
      bodyAngleX: [[0, 0], [1.3, -2.5], [3.3, 2.5], [5.6, 0]],
      bodyAngleZ: [[0, 0], [1.9, 1], [3.3, -1.5], [5.6, 0]],
      armAngle: [[0, 0], [1.3, -2.5], [3.3, 2], [5.6, 0]],
      gazeY: [[0, 0], [1.2, 0.4], [2, 0.3], [3.2, -0.4], [4.8, -0.2], [5.6, 0]],
      eyeOpen: [[0, 1], [1, 0.95], [1.9, 0.6], [3.4, 0.6], [4.6, 0.78], [5.6, 1]],
      browY: [[0, 0], [1.3, 0.35], [3.2, -0.2], [5.6, 0]],
      browAngle: [[0, 0], [1.9, -0.4], [4.6, -0.35], [5.6, 0]]
    }
  },
  doze: {
    label: "Drowsy",
    dur: 7.2,
    idle: !0,
    tracks: {
      eyeOpen: [[0, 1], [1.8, 0.78], [3.2, 0.62], [4.5, 0.55], [4.75, 1.1], [5.6, 1.05], [7.2, 1]],
      angleY: [[0, 0], [1.8, -6], [3.2, -9], [4.5, -17], [4.75, 5], [5.6, 2], [7.2, 0]],
      angleZ: [[0, 0], [2, 4], [4.5, 10], [4.75, -2], [7.2, 0]],
      angleX: [[0, 0], [4.5, -4], [4.75, 3], [5.4, -6], [6.2, 5], [7.2, 0]],
      bodyAngleZ: [[0, 0], [4.5, 3], [4.8, -2], [7.2, 0]],
      bodyAngleX: [[0, 0], [4.5, 2], [4.8, -1.5], [7.2, 0]],
      armAngle: [[0, 0], [4.5, 3], [4.8, -2], [7.2, 0]],
      handAngle: [[0, 0], [4.5, 5], [4.8, -1], [7.2, 0]],
      gazeY: [[0, 0], [4.5, -0.4], [4.75, 0.2], [7.2, 0]],
      gazeX: [[0, 0], [4.8, 0], [5.3, -0.6], [6.1, 0.6], [6.8, 0]],
      browY: [[0, 0], [4.5, -0.35], [4.75, 0.8], [5.8, 0.3], [7.2, 0]],
      // long, slow, deepening breaths; a sharp inhale on waking
      breath: [[0, 0], [1.1, 0.7], [2.6, 0], [3.8, 0.6], [4.5, 0.2], [4.8, 1.1], [6, 0.2], [7.2, 0]]
    }
  },
  stretch: {
    label: "Stretch",
    dur: 6.2,
    idle: !0,
    tracks: {
      angleZ: [[0, 0], [1.3, -22], [2.3, -21], [3.8, 20], [4.8, 19], [6.2, 0]],
      angleY: [[0, 0], [1.3, 5], [2.3, 7], [3.1, -3], [3.8, 5], [4.8, 6], [6.2, 0]],
      angleX: [[0, 0], [1.3, -5], [3.8, 5], [6.2, 0]],
      bodyAngleZ: [[0, 0], [1.3, 4], [3.8, -4], [6.2, 0]],
      bodyAngleX: [[0, 0], [1.3, -2], [3.8, 2], [6.2, 0]],
      armAngle: [[0, 0], [1.3, 2], [3.8, -2], [6.2, 0]],
      eyeOpen: [[0, 1], [0.8, 0.62], [4.9, 0.62], [5.6, 1]],
      browAngle: [[0, 0], [1, -0.3], [4.9, -0.3], [5.8, 0]],
      breath: [[0, 0], [1.3, 1.1], [2.3, 0.9], [3.1, 0.2], [3.8, 1.1], [4.8, 0.9], [6.2, 0]]
    }
  },
  lean: {
    label: "Peek",
    dur: 4.8,
    idle: !0,
    tracks: {
      bodyAngleX: [[0, 0], [0.9, 6], [3.4, 6], [4.4, 0]],
      bodyAngleZ: [[0, 0], [0.9, -3], [3.4, -3], [4.4, 0]],
      angleX: [[0, 0], [0.9, 9], [2, 7], [2.6, 10], [3.4, 8], [4.4, 0]],
      angleY: [[0, 0], [0.9, -6], [3.4, -5], [4.4, 0]],
      angleZ: [[0, 0], [0.9, 10], [2.2, 12], [3.4, 9], [4.4, 0]],
      armAngle: [[0, 0], [0.9, -3], [3.4, -3], [4.4, 0]],
      handAngle: [[0, 0], [0.9, 3], [3.4, 3], [4.4, 0]],
      gazeY: [[0, 0], [0.6, 0.45], [3.4, 0.4], [4.2, 0]],
      gazeX: [[0, 0], [1.5, 0], [1.8, -0.3], [2.3, 0.2], [2.8, 0], [4.2, 0]],
      eyeOpen: [[0, 1], [0.6, 1.1], [3.4, 1.08], [4.2, 1]],
      browY: [[0, 0], [0.6, 0.45], [3.4, 0.4], [4.2, 0]],
      browAngle: [[0, 0], [0.6, -0.3], [3.4, -0.3], [4.2, 0]],
      blush: [[0, 0], [1.2, 0.25], [3.4, 0.25], [4.4, 0]],
      breath: [[0, 0], [0.8, 0.8], [3.4, 0.6], [4.4, 0], [4.8, 0.2]]
    }
  },
  hum: {
    label: "Listen",
    dur: 5.6,
    idle: !0,
    tracks: {
      angleY: [[0, 0], [0.45, -5], [0.9, 2], [1.35, -5], [1.8, 2], [2.25, -5], [2.7, 2], [3.15, -5], [3.6, 2], [4.05, -4], [4.8, 0]],
      angleZ: [[0, 0], [0.9, 8], [1.8, -8], [2.7, 8], [3.6, -8], [4.6, 0]],
      angleX: [[0, 0], [0.9, 4], [1.8, -4], [2.7, 4], [3.6, -4], [4.6, 0]],
      bodyAngleZ: [[0, 0], [0.9, -3], [1.8, 3], [2.7, -3], [3.6, 3], [4.6, 0]],
      bodyAngleX: [[0, 0], [1.8, 2], [3.6, -2], [4.8, 0]],
      handAngle: [[0, 0], [0.9, 3], [1.8, -3], [2.7, 3], [3.6, -3], [4.6, 0]],
      fingerTap: [[0, 0], [0.45, 1], [0.9, 0], [1.35, 1], [1.8, 0], [2.25, 1], [2.7, 0], [3.15, 1], [3.6, 0], [5.6, 0]],
      gazeX: [[0, 0], [0.9, 0.3], [1.8, -0.3], [2.7, 0.3], [3.6, -0.3], [4.6, 0]],
      eyeOpen: [[0, 1], [0.4, 0.72], [4.6, 0.72], [5.3, 1]],
      eyeSmile: [[0, 0], [0.4, 0.55], [4.6, 0.55], [5.3, 0]],
      blush: [[0, 0], [0.8, 0.3], [4.6, 0.3], [5.6, 0]],
      browY: [[0, 0], [0.5, 0.25], [4.6, 0.25], [5.4, 0]],
      breath: [[0, 0], [0.9, 0.9], [1.8, 0.2], [2.7, 0.9], [3.6, 0.2], [4.6, 0.8], [5.6, 0]]
    }
  },
  tap: {
    label: "Tap",
    dur: 5,
    idle: !0,
    tracks: {
      gazeX: [[0, 0], [0.3, -0.6], [2.2, -0.5], [2.5, -0.1], [2.8, -0.6], [4.2, -0.5], [4.7, 0]],
      gazeY: [[0, 0], [0.3, 0.55], [4.2, 0.5], [4.7, 0]],
      angleX: [[0, 0], [0.8, -11], [2.4, -9], [3, -12], [4.2, -10], [5, 0]],
      angleY: [[0, 0], [0.8, 8], [4.2, 7], [5, 0]],
      angleZ: [[0, 0], [0.8, 6], [2.4, 4], [3, 7], [4.2, 5], [5, 0]],
      bodyAngleX: [[0, 0], [1, -2], [4.2, -2], [5, 0]],
      handAngle: [[0, 0], [0.8, 3], [4.2, 3], [5, 0]],
      fingerTap: [
        [0, 0],
        [0.9, 0],
        [1.05, 1],
        [1.2, 0],
        [1.4, 1],
        [1.55, 0],
        [1.75, 1],
        [1.9, 0],
        [2.6, 0],
        [2.75, 1],
        [2.9, 0],
        [3.1, 1],
        [3.25, 0],
        [5, 0]
      ],
      browY: [[0, 0], [0.6, 0.3], [4.2, 0.25], [5, 0]],
      browAngle: [[0, 0], [0.6, -0.35], [4.2, -0.3], [5, 0]],
      eyeOpen: [[0, 1], [0.6, 0.9], [4.2, 0.9], [5, 1]],
      breath: [[0, 0], [0.8, 0.7], [2.2, 0.4], [3.2, 0.8], [4.4, 0], [5, 0.2]]
    }
  },
  readNote: {
    label: "Read script",
    dur: 2.6,
    idle: !0,
    tracks: {
      // a quick look down at the notes on the desk and back to the camera
      gazeY: [[0, 0], [0.2, -0.85], [1.5, -0.8], [1.75, 0], [2.6, 0]],
      gazeX: [[0, 0], [0.2, -0.15], [1.5, -0.1], [1.75, 0]],
      angleY: [[0, 0], [0.45, -9], [1.5, -8], [2, 1], [2.6, 0]],
      angleZ: [[0, 0], [0.5, 2], [1.6, 2], [2.6, 0]],
      eyeOpen: [[0, 1], [0.3, 0.78], [1.5, 0.78], [1.75, 1]],
      breath: [[0, 0.3], [0.8, 0.5], [1.8, 0.2], [2.6, 0.4]]
    }
  },
  waiting: {
    label: "Fidget",
    dur: 6.4,
    idle: !0,
    tracks: {
      // shifts her weight, checks the viewer, looks away, shifts back
      bodyAngleZ: [[0, 0], [0.9, 5], [2.4, 4], [3.3, -5], [5.2, -4], [6.4, 0]],
      bodyAngleX: [[0, 0], [0.9, 3], [3.3, -3], [5.2, -2], [6.4, 0]],
      angleZ: [[0, 0], [1, -6], [2.4, -4], [3.4, 6], [5.2, 5], [6.4, 0]],
      angleX: [[0, 0], [1.2, -8], [2.2, 2], [3.6, 12], [5, 10], [6.2, 0]],
      angleY: [[0, 0], [1.2, -3], [2.2, 2], [3.6, -2], [6.2, 0]],
      armAngle: [[0, 0], [0.9, 3], [3.3, -3], [5.2, -2], [6.4, 0]],
      handAngle: [[0, 0], [1.2, 3], [3.4, -3], [6.4, 0]],
      fingerTap: [[0, 0], [4.2, 0], [4.35, 1], [4.5, 0], [4.7, 1], [4.85, 0], [6.4, 0]],
      gazeX: [[0, 0], [0.9, -0.7], [1.9, -0.6], [2.1, 0], [2.7, 0], [2.9, 0.8], [5, 0.7], [5.4, 0], [6.4, 0]],
      gazeY: [[0, 0], [0.9, -0.2], [2.1, 0], [2.9, 0.3], [5.4, 0]],
      eyeOpen: [[0, 1], [2, 1], [2.2, 1.06], [2.8, 1.05], [3.1, 0.85], [5.4, 0.85], [6.2, 1]],
      browAngle: [[0, 0], [0.9, -0.35], [2, -0.35], [2.3, 0], [3.1, -0.4], [5.4, -0.35], [6.4, 0]],
      browY: [[0, 0], [2.2, 0.4], [2.8, 0.35], [3.2, 0], [6.4, 0]],
      breath: [[0, 0.3], [0.9, 0.8], [2, 0.3], [2.6, 0.9], [3.4, 0.2], [4.4, 0.8], [5.6, 0], [6.4, 0.2]]
    }
  },
  spaceOut: {
    label: "Daydream",
    dur: 7.4,
    idle: !0,
    tracks: {
      // gaze drifts up and away, breaths get slow and long, one slow blink
      gazeX: [[0, 0], [1.4, -0.55], [4.8, -0.6], [5.6, 0.1], [7, 0]],
      gazeY: [[0, 0], [1.4, 0.6], [4.8, 0.55], [5.6, 0], [7, 0]],
      angleX: [[0, 0], [2, -9], [4.8, -10], [6, 2], [7.4, 0]],
      angleY: [[0, 0], [2, 7], [4.8, 8], [6, -2], [7.4, 0]],
      angleZ: [[0, 0], [2, 9], [4.8, 11], [6, 2], [7.4, 0]],
      bodyAngleZ: [[0, 0], [2.2, 3], [4.8, 3.5], [6.4, 0]],
      bodyAngleX: [[0, 0], [2.2, -2], [4.8, -2], [6.4, 0]],
      handAngle: [[0, 0], [2.2, 4], [4.8, 5], [6.4, 0]],
      armAngle: [[0, 0], [2.2, 2], [4.8, 2], [6.4, 0]],
      eyeOpen: [[0, 1], [1.4, 0.8], [3, 0.8], [3.35, 0.56], [3.8, 0.8], [4.8, 0.8], [5.6, 1.04], [6.4, 1]],
      browY: [[0, 0], [1.6, 0.15], [4.8, 0.15], [5.6, 0.35], [6.6, 0]],
      breath: [[0, 0], [1.6, 0.9], [3.4, 0], [5, 0.9], [6.2, 0.1], [7.4, 0]]
    }
  }
};
function Rr(e, t) {
  if (t <= e[0][0]) return e[0][1];
  const n = e.length - 1;
  if (t >= e[n][0]) return e[n][1];
  let r = 0;
  for (; t > e[r + 1][0]; ) r++;
  const [o, s] = e[r], [i, u] = e[r + 1], y = (p) => p <= 0 || p >= n ? 0 : (e[p + 1][1] - e[p - 1][1]) / (e[p + 1][0] - e[p - 1][0]), v = i - o, m = (t - o) / v, l = y(r) * v, c = y(r + 1) * v, f = m * m, h = f * m;
  return (2 * h - 3 * f + 1) * s + (h - 2 * f + m) * l + (-2 * h + 3 * f) * u + (h - f) * c;
}
const pt = {
  a: { open: 0.9, form: 0, label: "あ" },
  i: { open: 0.5, form: -0.85, label: "い" },
  u: { open: 0.4, form: 0.9, label: "う" },
  e: { open: 0.62, form: -0.4, label: "え" },
  o: { open: 0.75, form: 0.6, label: "お" },
  n: { open: 0, form: null, label: "ん" }
  // closes with the previous shape
}, kr = {
  a: "あかさたなはまやらわがざだばぱぁ",
  i: "いきしちにひみりぎじぢびぴぃ",
  u: "うくすつぬふむゆるぐずづぶぷぅゔ",
  e: "えけせてねへめれげぜでべぺぇ",
  o: "おこそとのほもよろをごぞどぼぽぉ"
}, Bn = {};
for (const [e, t] of Object.entries(kr)) for (const n of t) Bn[n] = e;
const Lr = /* @__PURE__ */ new Set([..."まみむめもばびぶべぼぱぴぷぺぽ"]), _r = /* @__PURE__ */ new Set([..."あいうえおぁぃぅぇぉ"]), yn = { ゃ: "a", ゅ: "u", ょ: "o" }, Fr = /* @__PURE__ */ new Set([..."、。，．,.！？!? 　…"]), jr = (e) => e.replace(/[ァ-ヶ]/g, (t) => String.fromCharCode(t.charCodeAt(0) - 96));
function Br(e, t = 0.14) {
  const n = [];
  for (const r of jr(e)) {
    const o = n[n.length - 1];
    if (yn[r] && o) {
      o.vowel = yn[r];
      continue;
    }
    if (r === "ー" && o) {
      o.dur += t;
      continue;
    }
    if (r === "っ") {
      n.push({ vowel: "n", dur: t * 0.8, onset: null });
      continue;
    }
    if (r === "ん") {
      n.push({ vowel: "n", dur: t, onset: null });
      continue;
    }
    if (Fr.has(r)) {
      n.push({ vowel: "n", dur: t * 2.2, onset: null });
      continue;
    }
    const s = Bn[r];
    s && n.push({ vowel: s, dur: t, onset: Lr.has(r) ? "lips" : _r.has(r) ? null : "consonant" });
  }
  return n;
}
function $r(e, t, n = 0.5) {
  if (n !== 0.5) return Ur(e, t, n);
  let r = 0;
  for (const o of e) {
    if (t < r + o.dur) {
      const s = (t - r) / o.dur, i = pt[o.vowel], u = o.onset === "lips" ? 0.05 : o.onset === "consonant" ? 0.45 : 1, y = s < 0.35 ? u + (1 - u) * (s / 0.35) : 1;
      return { open: i.open * y, form: i.form, vowel: o.vowel };
    }
    r += o.dur;
  }
  return null;
}
function Ur(e, t, n) {
  const r = n < 0.5 ? (0.5 - n) * 0.72 : 0;
  let o = 0, s = 0, i = null;
  for (const u of e) {
    let y = u.vowel;
    if (u.vowel === "n" ? r && u.dur <= 0.2 && i ? y = i : (s = 0, i = null) : ((!i || s >= r) && (i = u.vowel, s = 0), s += u.dur, r && (y = i)), t < o + u.dur) {
      const v = pt[y], m = u.onset === "lips" ? 0.05 : u.onset === "consonant" ? 0.45 : 1, l = n < 0.5 ? 1 - (1 - m) * n * 2 : m * (2 - n * 2), c = Math.min(u.dur * 0.35, 0.05), f = (t - o) / c;
      return { open: v.open * (f < 1 ? l + (1 - l) * f : 1), form: v.form, vowel: y };
    }
    o += u.dur;
  }
  return null;
}
const jt = { ...nn, ...rn }, vn = { amp: 1, stiff: 1.8 }, Yr = /^(angle|bodyAngle|armAngle|handAngle)/, Ir = /* @__PURE__ */ new Set([
  "eyeOpen",
  "eyeOpenL",
  "eyeSmileL",
  "eyeSmile",
  "mouthOpen",
  "mouthForm",
  "blush",
  "browY",
  "browAngle"
]), xt = (e, t, n) => {
  const r = Math.min(1, Math.max(0, (n - e) / (t - e)));
  return r * r * (3 - 2 * r);
};
function bn(e, t) {
  const n = Math.floor(e), r = e - n, o = (i) => {
    const u = Math.sin((i + t * 57.3) * 127.1) * 43758.5453;
    return u - Math.floor(u);
  }, s = r * r * (3 - 2 * r);
  return (o(n) * (1 - s) + o(n + 1) * s) * 2 - 1;
}
const ze = (e, t) => bn(e, t) * 0.7 + bn(e * 2.3, t + 9) * 0.3, Te = (e, t, n) => Math.max(t, Math.min(n, e)), $n = {
  normal: { label: "Neutral", p: {} },
  smile: { label: "Smile", p: { eyeOpen: 0, eyeSmile: 1, blush: 0.35, browY: 0.2 } },
  shy: { label: "Blush", p: { eyeOpen: 0.78, eyeSmile: 0.5, blush: 1, browAngle: -0.5, browY: -0.1, glance: [0.7, 0.35] } },
  jito: { label: "Half-lidded", p: { eyeOpen: 0.5, browY: -0.5, browAngle: 0.6 } },
  surprise: { label: "Surprise", p: { eyeOpen: 1.22, browY: 1, mouthOpen: 0.6, mouthForm: 0.6 } },
  wink: { label: "Wink", p: { eyeOpenL: 0, eyeSmileL: 1, blush: 0.3 } },
  // talking faces for AITuber OnAir emotion tags: eyes stay mostly open (closed / ^^ eyes are
  // what a single image fakes worst, and they would stay shut for a whole sentence)
  happyTalk: { label: "happy", p: { eyeOpen: 0.8, eyeSmile: 0.45, blush: 0.35, browY: 0.25, mouthForm: -0.5 } },
  sadTalk: { label: "sad", p: { eyeOpen: 0.78, browAngle: -0.8, browY: -0.2, mouthForm: 0.3, glance: [0, -0.35] } },
  angryTalk: { label: "angry", p: { eyeOpen: 0.72, browAngle: 0.85, browY: -0.55, mouthForm: 0.2 } },
  surprisedTalk: { label: "surprised", p: { eyeOpen: 1.18, browY: 0.9, mouthForm: 0.9 } },
  relaxedTalk: { label: "relaxed", p: { eyeOpen: 0.82, eyeSmile: 0.35, blush: 0.15, browY: 0.1 } }
}, wn = {
  happy: ["happyTalk", "nod"],
  sad: ["sadTalk", "sigh"],
  angry: ["angryTalk", "no"],
  surprised: ["surprisedTalk", "surprise"],
  relaxed: ["relaxedTalk", "sway"],
  neutral: ["normal", null]
}, Nr = {
  gazeX: [260, 0.9],
  gazeY: [260, 0.9],
  angleX: [55, 0.72],
  angleY: [55, 0.72],
  angleZ: [45, 0.75],
  bodyAngleX: [14, 0.9],
  bodyAngleZ: [12, 0.9],
  weightShift: [14, 0.9],
  armAngle: [20, 0.85],
  handAngle: [30, 0.8]
};
function Xr(e) {
  const n = (e + 0.45) % 5, r = n < 2.5 ? -0.7 : 0.7, o = -r, s = n % 2.5;
  if (s >= 0.9) return o;
  const i = s / 0.9, u = i * i * i * (10 + i * (-15 + 6 * i));
  return r + (o - r) * u;
}
class zr {
  /** @param {number[]} gazeCenter @param {boolean} [planted] @param {import('../rig/types').Rig|null} [armRig] */
  constructor(t, n = !1, r = null) {
    this.armRig = r, this.armFollow = 0, this.armVelocity = 0, this.planted = n, this.mode = "auto", this.P = Object.fromEntries(bt.map((o) => [o.id, o.def])), this.manual = { ...this.P }, this.cur = { ...this.P }, this.vel = Object.fromEntries(bt.map((o) => [o.id, 0])), this.expr = "normal", this.exprMix = {}, this.t = 0, this.blink = { t: 0, start: 1.5, double: !1 }, this.gaze = { x: 0, y: 0, next: 0 }, this.tap = { next: 4, until: -1 }, this.pointer = null, this.faceCenter = [...t], this.lipOpen = null, this.lipForm = 0, this.speaking = !1, this.voice = 0, this.mouth = 0, this.vowel = "a", this.vowelForm = 0, this.lipSync = dn(), this.lipMotion = gn(this.lipSync), this.syllableArmed = !0, this.voicePeak = 0, this.voiceTrough = 0, this.kana = null, this.lipHold = null, this.emotionUntil = 0, this.talkGain = 1, this.play = null, this.autoMotion = !0, this.nextAuto = 14, this.autoIdle = !0, this.nextIdle = 3, this.lastAuto = null, this.onMotion = null;
  }
  setExpression(t) {
    this.expr = t;
  }
  hasMotion(t) {
    return t in jt;
  }
  // ---- speech (driven from outside, e.g. by the TTS audio analyser) ----
  setVoiceLevel(t) {
    this.voice = Math.min(1, Math.max(0, Number(t) || 0));
  }
  setLipSync(t) {
    this.lipSync = dn(t, this.lipSync), this.lipMotion = gn(this.lipSync);
  }
  setSpeaking(t) {
    t !== this.speaking && (this.speaking = !!t, t || (this.emotionUntil = this.t + 1.2, this.voice = 0));
  }
  /** `playMotion: false` changes only the face (a caller that picks motions itself). */
  setEmotion(t, { playMotion: n = !0 } = {}) {
    const r = wn[t] ?? wn.neutral;
    this.expr = r[0], this.emotionUntil = 1 / 0, r[1] && n && this.playMotion(r[1]);
  }
  /** Mouth shapes from kana text, without audio (preview / tuning). */
  /** @param {string} text @param {{ speed?: number, loop?: boolean }} [options] */
  speakKana(t, { speed: n, loop: r = !1 } = {}) {
    this.lipHold = null;
    const o = Br(t, n === void 0 ? 0.14 : 1 / Te(Number(n) || 7, 4, 12));
    this.kana = o.length ? { moras: o, t: 0, loop: r, duration: o.reduce((s, i) => s + i.dur, 0) } : null;
  }
  holdMouth(t) {
    this.kana = null, this.lipHold = Object.hasOwn(pt, t) ? t : null;
  }
  stopLipSync() {
    this.kana = null, this.lipHold = null, this.lipOpen = null, this.mouth = 0;
  }
  getLipSyncState() {
    return { active: this.kana !== null || this.lipHold !== null, open: this.P.mouthOpen, form: this.P.mouthForm };
  }
  // Mouth from the TTS loudness. A volume signal has no vowel information, so each syllable
  // (the voice dipping and rising again) gets one vowel at random, weighted towards a, and
  // keeps it until the next syllable: the drawn mouths must not change shape mid-syllable.
  // Syllables are found relative to the recent peak (not an absolute level), and the mouth
  // is scaled by where the voice sits between the recent trough and peak, so it closes in
  // the dip before each mora even when a loud voice never gets quiet.
  speechMouth(t) {
    if (this.kana || this.lipHold) {
      let c;
      if (this.lipHold ? c = pt[this.lipHold] : (this.kana.t += t, this.kana.loop && (this.kana.t %= this.kana.duration), c = $r(this.kana.moras, this.kana.t, this.lipSync.granularity)), !c)
        return this.kana = null, this.mouth > 0.01 ? [this.mouth *= this.lipSync.closeSpeed === 0.5 ? 0.6 : Math.exp(-t * this.lipMotion.kanaRelease), this.vowelForm] : null;
      const f = this.lipMotion.openness === 1 ? c.open : Math.min(1, c.open * this.lipMotion.openness), h = f > this.mouth ? 1 - Math.exp(-t * 30) : 1 - Math.exp(-t * this.lipMotion.kanaRelease);
      return this.mouth += (f - this.mouth) * h, c.form !== null && (this.vowelForm = c.form), [this.mouth, this.vowelForm];
    }
    const n = this.speaking ? this.voice : 0, r = 1 - Math.exp(-t * this.lipMotion.relax);
    this.voicePeak = n > this.voicePeak ? n : this.voicePeak + (n - this.voicePeak) * r, this.voiceTrough = n < this.voiceTrough ? n : this.voiceTrough + (n - this.voiceTrough) * r;
    const o = Math.max(this.voicePeak, 0.05);
    if (n < o * this.lipMotion.arm) this.syllableArmed = !0;
    else if (this.syllableArmed && n > o * this.lipMotion.trigger && n > 0.1) {
      this.syllableArmed = !1;
      const c = Math.random();
      this.vowel = c < 0.4 ? "a" : c < 0.58 ? "o" : c < 0.74 ? "e" : c < 0.88 ? "i" : "u";
    }
    const s = this.voicePeak - this.voiceTrough, i = s < o * this.lipMotion.range ? 1 : Math.max(0, (n - this.voiceTrough) / s), u = pt[this.vowel ?? "a"], y = Math.min(1, Math.pow(n, 0.7) * 1.15) * Math.pow(i, this.lipMotion.risePower), v = this.speaking ? Math.min(0.95, y) * (0.45 + 0.55 * u.open / 0.9) : 0, m = this.lipMotion.openness === 1 ? v : Math.min(1, v * this.lipMotion.openness), l = m > this.mouth ? 1 - Math.exp(-t * 40) : 1 - Math.exp(-t * this.lipMotion.audioRelease);
    return this.mouth += (m - this.mouth) * l, this.speaking && (this.vowelForm = u.form), this.speaking || this.mouth > 0.01 ? [this.mouth, this.vowelForm] : null;
  }
  // Breathing: inhale ~40% of the cycle, a slower exhale, a short pause at the bottom,
  // and a period that drifts between ~3.2 and 4.6 s so it never looks metronomic.
  breathValue(t) {
    this.breathPhase = (this.breathPhase ?? 0) + t / (this.breathPeriod ?? 3.8), this.breathPhase >= 1 && (this.breathPhase -= 1, this.breathPeriod = 3.2 + Math.random() * 1.4);
    const n = this.breathPhase;
    return n < 0.4 ? xt(0, 0.4, n) : n < 0.88 ? 1 - xt(0.4, 0.88, n) : 0;
  }
  // pick one at random, never the one that just played
  playRandom(t) {
    const n = t.filter((r) => r !== this.lastAuto);
    this.playMotion(n[Math.floor(Math.random() * n.length)]);
  }
  playMotion(t) {
    this.lastAuto = t, this.play = { id: t, t: 0 }, this.onMotion?.(t);
  }
  blinkValue(t) {
    const n = this.blink;
    if (n.t += t, n.t < n.start) return 1;
    const r = (n.t - n.start) / 0.17;
    return r >= 1 ? (n.double ? (n.double = !1, n.start = n.t + 0.07) : (n.start = n.t + 1.8 + Math.random() * 4.2, n.double = Math.random() < 0.18), 1) : r < 0.45 ? 1 - r / 0.45 : (r - 0.45) / 0.55;
  }
  update(t) {
    this.t += t;
    const n = this.t, r = {};
    for (const h of bt) r[h.id] = h.def;
    if (this.mode === "manual")
      Object.assign(r, this.manual);
    else if (this.mode === "auto") {
      if (r.angleX = ze(n * 0.18, 1) * 10 + this.gaze.x * 11, r.angleY = ze(n * 0.15, 2) * 6 - 1 + this.gaze.y * 7, r.angleZ = ze(n * 0.12, 3) * 10, r.bodyAngleX = ze(n * 0.1, 4) * 5 * (this.planted ? 0.35 : 1), r.bodyAngleZ = ze(n * 0.09, 5) * 4 * (this.planted ? 0.35 : 1), r.weightShift = this.planted ? Xr(n) : 0.7 * Math.sin(n * Math.PI * 2 / 5), r.armAngle = ze(n * 0.14, 6) * 5, r.handAngle = ze(n * 0.21, 7) * 5, n > this.gaze.next) {
        const h = Math.random();
        this.gaze.x = h < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.8, this.gaze.y = h < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.5, this.gaze.next = n + 0.8 + Math.random() * 2.5;
      }
      if (r.gazeX = this.gaze.x + r.angleX / 60, r.gazeY = this.gaze.y + r.angleY / 60, n > this.tap.next && (this.tap.until = n + 1.1, this.tap.next = n + 5 + Math.random() * 6), this.speaking) {
        this.nextIdle = Math.max(this.nextIdle, n + 2.5), this.nextAuto = Math.max(this.nextAuto, n + 6);
        const h = this.talkGain;
        this.talkNod = (this.talkNod ?? 0) + (this.voice * 7 * h - (this.talkNod ?? 0)) * Math.min(1, t * 6), r.angleY -= this.talkNod, r.angleX += ze(n * 0.6, 11) * 5 * h, r.angleZ += ze(n * 0.5, 12) * 4 * h;
      }
      !this.speaking && n > this.emotionUntil && (this.expr = "normal", this.emotionUntil = 1 / 0), this.speaking || (!this.play && this.autoMotion && n > this.nextAuto ? (this.playRandom(Object.keys(nn).filter((h) => h !== "surprise")), this.nextAuto = n + 15 + Math.random() * 10, this.nextIdle = Math.max(this.nextIdle, n + 5)) : !this.play && this.autoIdle && n > this.nextIdle && (this.playRandom(Object.keys(rn)), this.nextIdle = n + 5 + Math.random() * 5));
    } else if (this.mode === "mouse" && this.pointer) {
      const h = (this.pointer[0] - this.faceCenter[0]) / 500, p = (this.pointer[1] - this.faceCenter[1]) / 500;
      r.angleX = Te(h * 30, -30, 30), r.angleY = Te(-p * 30, -30, 30), r.angleZ = Te(-h * p * 25, -12, 12), r.bodyAngleX = Te(h * 10, -10, 10) * 0.6, r.gazeX = Te(h * 1.4, -1, 1), r.gazeY = Te(-p * 1.4, -1, 1), r.handAngle = Te(h * 4, -5, 5);
    }
    this.mode !== "manual" && (r.breath = this.breathValue(t), n < this.tap.until && (r.fingerTap = Math.max(0, Math.sin((this.tap.until - n) * Math.PI * 3.6)) ** 2));
    let o = null, s = 0;
    if (this.play) {
      const h = jt[this.play.id];
      if (this.play.t += t, this.play.t >= h.dur)
        this.play = null, this.onMotion?.(null);
      else {
        o = {};
        for (const [p, g] of Object.entries(h.tracks))
          o[p] = Rr(g, this.play.t) * (h.idle && Yr.test(p) ? vn.amp : 1);
        s = xt(0, 0.15, this.play.t) * (1 - xt(h.dur - 0.25, h.dur, this.play.t));
        for (const [p, g] of Object.entries(o))
          Tr.has(p) ? r[p] += g : p === "breath" ? r[p] += (g - r[p]) * s : Ir.has(p) || (r[p] = Math.max(r[p], Math.max(0, g)));
      }
    }
    if (this.mode !== "manual" && (r.angleY += r.breath * 1.6), this.armRig?.arms && this.mode !== "manual") {
      const { arms: h, body: p, legs: g } = this.armRig, b = -r.bodyAngleZ / 10 * p.maxRoll + (g ? g.tilt * (1 - (g.spine ?? 0.7)) * r.weightShift : 0), a = Te(t, 0, 0.05), d = Math.ceil(a * 240);
      for (let A = 0; A < d; A++) {
        const L = a / d;
        this.armVelocity += (100 * (-b * 0.65 - this.armFollow) - 18 * this.armVelocity) * L, this.armFollow += this.armVelocity * L;
      }
      const x = (h.swing ?? mt.swing) * Math.PI / 180, w = h.inward ?? mt.inward;
      for (const [A, L] of [["L", 1], ["R", -1]]) {
        const z = L * this.armFollow, Y = x * (z < 0 ? w : 1);
        r[`armSwing${A}`] = Te((Y > 0 ? z / Y : 0) + (r.breath - 0.5) * 0.06, -1, 1), r[`elbowBend${A}`] = r.breath * 0.025;
      }
    }
    const i = $n[this.expr].p, u = ["eyeOpen", "eyeOpenL", "eyeSmileL", "eyeSmile", "mouthOpen", "mouthForm", "blush", "browY", "browAngle", "gx", "gy"], y = {
      eyeOpen: i.eyeOpen ?? 1,
      eyeOpenL: i.eyeOpenL ?? i.eyeOpen ?? 1,
      eyeSmileL: i.eyeSmileL ?? i.eyeSmile ?? 0,
      eyeSmile: i.eyeSmile ?? 0,
      mouthOpen: i.mouthOpen ?? 0,
      mouthForm: i.mouthForm ?? 0,
      blush: i.blush ?? 0,
      browY: i.browY ?? 0,
      browAngle: i.browAngle ?? 0,
      gx: i.glance?.[0] ?? 0,
      gy: i.glance?.[1] ?? 0
    }, v = 1 - Math.exp(-t * 9);
    for (const h of u)
      this.exprMix[h] === void 0 && (this.exprMix[h] = y[h]), this.exprMix[h] += (y[h] - this.exprMix[h]) * v;
    const m = this.exprMix, l = {};
    for (const h of bt) {
      const p = h.id;
      if (this.mode === "manual" && !o) {
        l[p] = r[p], this.cur[p] = r[p], this.vel[p] = 0;
        continue;
      }
      let [g, b] = Nr[p] ?? [120, 0.95];
      o && /^angle|^body/.test(p) && (jt[this.play?.id ?? ""]?.idle ? (g *= vn.stiff, b = 0.8) : /^angle/.test(p) && (g *= 4.5, b = 0.75));
      const a = 2 * Math.sqrt(g) * b;
      this.vel[p] += (g * (r[p] - this.cur[p]) - a * this.vel[p]) * t, this.cur[p] += this.vel[p] * t, l[p] = this.cur[p];
    }
    let c = 1;
    if (this.mode !== "manual" ? (c = this.blinkValue(t), l.eyeROpen = m.eyeOpen * c, l.eyeLOpen = m.eyeOpenL * c, l.eyeSmile = m.eyeSmile, l.eyeSmileL = m.eyeSmileL, l.mouthOpen = m.mouthOpen, l.mouthForm = m.mouthForm, l.blush = m.blush, l.browY = m.browY + (l.angleY > 0 ? l.angleY / 60 : 0) - (1 - c) * 0.18, l.browAngle = m.browAngle, l.gazeX = Te(l.gazeX + m.gx, -1, 1), l.gazeY = Te(l.gazeY + m.gy, -1, 1)) : l.eyeSmileL = l.eyeSmile, o) {
      const h = (g, b) => {
        l[g] += (b - l[g]) * s;
      }, p = (g) => Math.min(1.3, Math.max(0, g));
      "eyeOpen" in o && (h("eyeROpen", p(o.eyeOpen) * c), "eyeOpenL" in o || h("eyeLOpen", p(o.eyeOpen) * c)), "eyeOpenL" in o && h("eyeLOpen", p(o.eyeOpenL) * c), "eyeSmile" in o && (h("eyeSmile", o.eyeSmile), "eyeSmileL" in o || h("eyeSmileL", o.eyeSmile)), "eyeSmileL" in o && h("eyeSmileL", o.eyeSmileL);
      for (const g of ["mouthOpen", "mouthForm", "blush", "browY", "browAngle"])
        g in o && h(g, g === "mouthOpen" || g === "blush" ? Math.max(0, o[g]) : o[g]);
    }
    const f = this.speechMouth(t);
    return f ? (this.lipOpen = f[0], this.lipForm = f[1]) : this.lipOpen !== null && !this.speaking && !this.kana && (this.lipOpen = null), this.lipOpen !== null && (l.mouthOpen = Math.max(l.mouthOpen * 0.3, this.lipOpen), l.mouthForm = Te(this.lipForm, -1, 1)), this.P = l, l;
  }
}
const Ot = {
  neutral: "normal",
  smile: "smile",
  shy: "shy",
  surprise: "surprise",
  halfLidded: "jito",
  angry: "angryTalk",
  sad: "sadTalk",
  wink: "wink"
}, Cr = { sad: { pitch: -6, gy: -0.45 } }, lt = (e, t, n) => Math.max(t, Math.min(n, e)), ct = Object.freeze({ eyeOpen: 1, eyeOpenL: 1, eyeSmile: 0, eyeSmileL: 0, blush: 0, browY: 0, browAngle: 0, mouthOpen: 0, mouthForm: 0, gx: 0, gy: 0, pitch: 0 });
function Dr(e, t = {}) {
  const n = $n[Ot[e]]?.p ?? {}, r = Cr[e] ?? {}, o = e === "neutral" ? void 0 : t[e]?.mouthOpen;
  return {
    eyeOpen: n.eyeOpen ?? 1,
    eyeOpenL: n.eyeOpenL ?? n.eyeOpen ?? 1,
    eyeSmile: n.eyeSmile ?? 0,
    eyeSmileL: n.eyeSmileL ?? n.eyeSmile ?? 0,
    blush: n.blush ?? 0,
    browY: n.browY ?? 0,
    browAngle: n.browAngle ?? 0,
    mouthOpen: o ?? n.mouthOpen ?? 0,
    mouthForm: n.mouthForm ?? 0,
    gx: n.glance?.[0] ?? 0,
    gy: r.gy ?? n.glance?.[1] ?? 0,
    pitch: r.pitch ?? 0
  };
}
function Pr(e, t) {
  const n = { ...e };
  return n.eyeROpen = (e.eyeROpen ?? 1) * t.eyeOpen, n.eyeLOpen = (e.eyeLOpen ?? 1) * t.eyeOpenL, n.eyeSmile = Math.max(e.eyeSmile ?? 0, t.eyeSmile), n.eyeSmileL = Math.max(e.eyeSmileL ?? e.eyeSmile ?? 0, t.eyeSmileL), n.blush = Math.max(e.blush ?? 0, t.blush), n.browY = lt((e.browY ?? 0) + t.browY, -1, 1), n.browAngle = lt((e.browAngle ?? 0) + t.browAngle, -1, 1), n.mouthOpen = Math.max(e.mouthOpen ?? 0, t.mouthOpen), t.mouthOpen > (e.mouthOpen ?? 0) && (n.mouthForm = t.mouthForm), n.gazeX = lt((e.gazeX ?? 0) + t.gx, -1, 1), n.gazeY = lt((e.gazeY ?? 0) + t.gy, -1, 1), n.angleY = lt((e.angleY ?? 0) + t.pitch, -30, 30), n;
}
class Hr {
  /** @type {keyof typeof OVERLAY_EXPRESSIONS} */
  name = "neutral";
  mix = { ...ct };
  /** @param {Record<string, { mouthOpen?: number }>} [settings] parsed per-expression settings */
  constructor(t = {}) {
    this.settings = t;
  }
  /** @param {string} name */
  set(t) {
    this.name = Object.hasOwn(Ot, t) ? (
      /** @type {keyof typeof OVERLAY_EXPRESSIONS} */
      t
    ) : "neutral";
  }
  /** True while an expression is shown or still fading out. */
  get active() {
    return this.name !== "neutral" || Object.keys(ct).some((t) => Math.abs(this.mix[t] - ct[t]) > 1e-3);
  }
  apply(t, n) {
    if (!this.active)
      return this.mix = { ...ct }, t;
    const r = Dr(this.name, this.settings), o = 1 - Math.exp(-Math.max(0, n) * 12);
    for (const s of Object.keys(ct)) this.mix[s] += (r[s] - this.mix[s]) * o;
    return Pr(t, this.mix);
  }
}
const xn = (e) => !!e && typeof e == "object" && !Array.isArray(e);
function on(e) {
  if (!xn(e)) throw new TypeError("expressions: expected an object");
  const t = {};
  for (const [n, r] of Object.entries(e)) {
    if (n === "neutral" || !Object.hasOwn(Ot, n)) continue;
    if (!xn(r)) throw new TypeError(`expressions.${n}: expected an object`);
    const o = {}, s = r.mouthOpen;
    if (s !== void 0) {
      if (typeof s != "number" || !Number.isFinite(s) || s < 0 || s > 1)
        throw new RangeError(`expressions.${n}.mouthOpen: expected 0–1`);
      o.mouthOpen = s;
    }
    t[n] = o;
  }
  return t;
}
function Vr(e = {}, t = {}) {
  const n = {};
  for (const r of /* @__PURE__ */ new Set([...Object.keys(e), ...Object.keys(t)]))
    n[r] = { ...e[r], ...t[r] };
  return n;
}
const Mn = ["ball", "low", "crease", "lash"], Bt = /* @__PURE__ */ new Map(), $t = /* @__PURE__ */ new Map();
async function Ut(e) {
  return $t.has(e) || $t.set(e, fetch(e).then((t) => {
    if (!t.ok) throw new Error(`failed to load ${e}`);
    return t.json();
  })), $t.get(e);
}
function Yt(e) {
  if (Bt.has(e)) return Bt.get(e);
  const t = new Promise((n, r) => {
    const o = new Image();
    o.onload = () => n(o), o.onerror = () => r(new Error(`failed to load ${e}`)), o.src = e;
  });
  return Bt.set(e, t), t;
}
function Un(e, t) {
  const n = document.createElement("canvas");
  n.width = e.width, n.height = e.height;
  const r = n.getContext("2d");
  r.drawImage(e, 0, 0);
  const o = r.getImageData(0, 0, n.width, n.height).data, s = new Uint8Array(n.width * n.height);
  for (let i = 0; i < s.length; i++) s[i] = o[i * 4 + t];
  return s;
}
const Ze = (e) => Un(e, 3);
function Zr(e, [t, n, r, o]) {
  const s = document.createElement("canvas");
  return s.width = r, s.height = o, s.getContext("2d").drawImage(e, t, n, r, o, 0, 0, r, o), s;
}
function Wr(e, t) {
  const [n, r] = e.t.pivot, o = e.dir, s = e.pts, i = (f, h, p) => {
    const g = Math.min(1, Math.max(0, (p - f) / (h - f)));
    return g * g * (3 - 2 * g);
  }, u = Math.cos(e.phi[0]), y = Math.sin(e.phi[0]), v = Math.cos(e.phi[1]), m = Math.sin(e.phi[1]), l = t.rest, c = t.pos;
  for (let f = 0; f < l.length; f += 2) {
    const h = l[f] - n, p = l[f + 1] - r, g = h * o[0] + p * o[1], b = s[0][0] + h * u - p * y, a = s[0][1] + h * y + p * u, d = h - o[0] * e.L1, x = p - o[1] * e.L1, w = s[1][0] + d * v - x * m, A = s[1][1] + d * m + x * v, L = i(e.L1 * 0.55, e.L1 * 1.35, g);
    c[f] = b + (w - b) * L, c[f + 1] = a + (A - a) * L;
  }
}
async function Gr(e, t) {
  if (!t.assets && t.assetsBase === void 0)
    throw new Error("createMeshAvatar requires assets or assetsBase.");
  const n = t.rig, r = tr(n), {
    IMG: o,
    EYES: s,
    baseWeights: i,
    deformBase: u,
    eyePartY: y,
    eyePartAlpha: v,
    handWeights: m,
    handFrame: l,
    deformHand: c,
    TASSELS: f
  } = r, { Renderer: h, buildGrid: p } = dr(r, n), { Physics: g } = gr(r, n), { Cloth: b } = Mr(r, n), a = n.cloth ?? [], { createSprites: d } = Ar(r, n), x = (t.assetsBase ?? "").replace(/\/?$/, "/"), w = (S, R) => {
    if (t.assets) {
      if (!t.assets[S]) throw new Error(`Missing project asset: ${S}`);
      return t.assets[S];
    }
    return `${x}${S}${R === void 0 ? "" : `?b=${R}`}`;
  }, A = await Ut(w("layers.json")), z = [a.length ? "base_cloth" : "base", ...n.hand ? ["hand"] : [], ...f.map((S) => S.name), ...a.map((S) => `cloth_${S.name}`), ...[0, 1].flatMap((S) => Mn.map((R) => `eye${S}_${R}`)), "hairmask"], Y = Object.fromEntries(await Promise.all(z.map(async (S) => [S, await Yt(w(`${S}.png`, A.build))])));
  a.length && (Y.base = Y.base_cloth);
  const I = Un(Y.hairmask, 0), U = (S, R) => I[Math.min(o.h - 1, Math.max(0, Math.round(R))) * o.w + Math.min(o.w - 1, Math.max(0, Math.round(S)))] / 255, T = new h(e, { padTop: t.padTop ?? n.view.padTop, padSide: t.padSide ?? n.view.padSide, fit: t.fit }), F = { base: [0, 0, o.w, o.h], ...A.layers }, j = new b(), C = (S) => {
    const R = `cloth_${S.name}`, P = p(F[R], n.mesh.clothCell ?? 8, Ze(Y[R]), Y[R].width);
    j.attach(S.name, P), T.addLayer(R, Y[R], P);
  };
  a.filter((S) => S.behind).forEach(C);
  const B = p(F.base, n.mesh.baseCell, Ze(Y.base), Y.base.width, n.mesh.fine), H = [];
  for (let S = 0; S < B.rest.length / 2; S++) {
    const R = B.rest[S * 2], P = B.rest[S * 2 + 1];
    H.push(i(R, P, U(R, P)));
  }
  T.addLayer("base", Y.base, B, { face: !0 });
  const N = [];
  s.forEach((S, R) => {
    for (const P of Mn) {
      const se = `eye${R}_${P}`, ie = p(F[se], P === "ball" ? n.mesh.eyeBallCell : n.mesh.eyeCell, Ze(Y[se]), Y[se].width), pe = [];
      for (let Me = 0; Me < ie.rest.length / 2; Me++) pe.push(i(ie.rest[Me * 2], ie.rest[Me * 2 + 1], 0));
      const be = T.addLayer(se, Y[se], ie, { eyeBall: P === "ball" ? R : void 0 });
      N.push({ e: S, eye: R, part: P, mesh: ie, W: pe, layer: be });
    }
  });
  let ne = null;
  try {
    {
      const S = await Ut(w("sprites/sprites.json")), R = Object.fromEntries(await Promise.all(Object.keys(S.layers).map(async (P) => [P, await Yt(w(`sprites/${P}.png`, S.build))])));
      ne = d(T, S, R, p, Ze);
    }
  } catch (S) {
    console.warn("eye / mouth sprites not loaded:", S);
  }
  a.filter((S) => !S.behind).forEach(C);
  let Q = null;
  try {
    const S = await Ut(w("overlays/overlays.json")), R = Object.fromEntries(await Promise.all(S.overlays.map(async (P) => [P.name, await Yt(w(`overlays/${P.file}`))])));
    Q = Or(T, S, R, p, Ze, i, n.mesh.spriteCell, o.w, o.h, Zr);
  } catch (S) {
    t.assets?.["overlays/overlays.json"] && console.warn("overlay layers not loaded:", S);
  }
  const J = f.map((S) => {
    const R = p(F[S.name], n.mesh.tasselCell, Ze(Y[S.name]), Y[S.name].width);
    return T.addLayer(S.name, Y[S.name], R);
  }), X = n.hand ? p(F.hand, n.mesh.handCell, Ze(Y.hand), Y.hand.width) : { rest: [], pos: [] }, G = [];
  for (let S = 0; S < X.rest.length / 2; S++) G.push(m(X.rest[S * 2], X.rest[S * 2 + 1]));
  n.hand && T.addLayer("hand", Y.hand, X);
  const re = new g(), W = new zr(n.view.gazeCenter ?? [n.head.cx, n.head.cy], !!n.legs, n.arms ? n : null);
  t.lipSync !== void 0 && W.setLipSync(t.lipSync);
  const te = /* @__PURE__ */ new Set();
  W.onMotion = (S) => {
    for (const R of te) R(S);
  };
  let ae = {}, V = 1, M = {}, E = {};
  const O = new Hr(t.expressions === void 0 ? void 0 : on(t.expressions)), k = [0, 0];
  function $(S) {
    const R = { ...W.update(S) };
    for (const [se, ie] of Object.entries(ae)) {
      const pe = V * (M[se] ?? 1);
      R[se] = pe === 1 ? ie : (R[se] ?? 0) + (ie - (R[se] ?? 0)) * pe;
    }
    W.lipOpen !== null && (R.mouthOpen = W.P.mouthOpen, (!t.preserveMouthForm || ae.mouthForm === void 0) && (R.mouthForm = W.P.mouthForm));
    const P = O.apply(R, S);
    return E = P, P;
  }
  function Z(S) {
    const R = $(S), P = re.step(R, S), se = B.pos, ie = B.rest;
    for (let K = 0; K < H.length; K++)
      u(ie[K * 2], ie[K * 2 + 1], H[K], R, P, k), se[K * 2] = k[0], se[K * 2 + 1] = k[1];
    const pe = (K, ce) => ne?.eyesDrawn[ce] ? 1 : K;
    for (const K of N) {
      const ce = pe(K.eye === 0 ? R.eyeROpen : R.eyeLOpen, K.eye), ue = K.eye === 0 ? R.eyeSmile : R.eyeSmileL ?? R.eyeSmile;
      K.layer.alpha = v(K.part, ce, ue);
      const ke = K.mesh.rest, Se = K.mesh.pos;
      for (let ye = 0; ye < K.W.length; ye++) {
        const Le = ke[ye * 2], $e = ke[ye * 2 + 1];
        u(Le, y(K.e, K.part, Le, $e, ce, ue), K.W[ye], R, P, k), Se[ye * 2] = k[0], Se[ye * 2 + 1] = k[1];
      }
    }
    const be = ne?.update(R, P, S, Er(O.name, W.mode === "manual" ? null : W.expr));
    if (be) for (const K of N) be.eyes[K.eye] && (K.layer.alpha = 0);
    Q?.update(R, P, u, k);
    const Me = X.pos, Be = X.rest, Ee = l(R);
    for (let K = 0; K < G.length; K++)
      c(Be[K * 2], Be[K * 2 + 1], G[K], R, Ee, k), Me[K * 2] = k[0], Me[K * 2 + 1] = k[1];
    re.chains.forEach((K, ce) => Wr(K, J[ce].mesh)), a.length && (j.step(R, S, P), j.deform());
    const de = n.view.irisTravel ?? 7;
    T.draw({
      angleX: R.angleX,
      angleY: R.angleY,
      angleZ: R.angleZ,
      eyes: [
        pe(R.eyeROpen, 0),
        R.eyeSmile,
        R.gazeX * de,
        -R.gazeY * de * 0.6,
        pe(R.eyeLOpen, 1),
        R.eyeSmileL ?? R.eyeSmile,
        R.gazeX * de * 0.85,
        -R.gazeY * de * 0.6
      ],
      // with sprites the drawn mouths replace the shader-painted one
      mouthOpen: be?.mouthDrawn ? 0 : R.mouthOpen,
      mouthForm: R.mouthForm,
      cheek: R.blush,
      showMesh: !1,
      originalAlpha: 0,
      joints: []
    });
  }
  let _ = 0, D = performance.now(), q = !1;
  const ee = (S) => {
    const R = Math.min(0.05, (S - D) / 1e3);
    D = S, Z(R), _ = requestAnimationFrame(ee);
  };
  return t.manual || (_ = requestAnimationFrame(ee)), {
    motions: [
      ...Object.entries(nn).map(([S, R]) => ({ id: S, label: R.label, idle: !1 })),
      ...Object.entries(rn).map(([S, R]) => ({ id: S, label: R.label, idle: !0 }))
    ],
    setParameters(S, R = 1, P = {}) {
      ae = { ...S }, V = Math.min(1, Math.max(0, Number(R) || 0)), M = Object.fromEntries(Object.entries(P ?? {}).map(([se, ie]) => [se, Math.min(1, Math.max(0, Number(ie) || 0))]));
    },
    getParameters() {
      return { ...E };
    },
    /** 0..1 loudness of the voice being played (e.g. normalised RMS). */
    setVoiceLevel(S) {
      W.setVoiceLevel(S);
    },
    /** Partial mouth-movement settings; omitted fields retain their current values. */
    setLipSync(S) {
      W.setLipSync(S);
    },
    /** true while TTS audio is playing: idle motions pause and the head nods along. */
    setSpeaking(S) {
      W.setSpeaking(S);
    },
    /** AITuber OnAir emotion tag: happy / sad / angry / surprised / relaxed / neutral (or null). */
    setEmotion(S, R) {
      W.setEmotion(S, R);
    },
    /** Live expression layered over tracking (see OVERLAY_EXPRESSIONS); 'neutral' clears it. */
    setExpression(S) {
      O.set(S);
    },
    /** Show the named overlay layers (built/overlays/overlays.json) and hide the others. */
    setOverlays(S) {
      Q?.set(S);
    },
    getExpression() {
      return { name: O.name, active: O.active };
    },
    /** How much the head moves with the voice while speaking (1 = default, calmer below). */
    setTalkGain(S) {
      W.talkGain = Math.max(0, Number(S) || 0);
    },
    /** Play a motion or idle motion by id (see `motions`). */
    play(S) {
      W.hasMotion(S) && W.playMotion(S);
    },
    /** Move the mouth through the vowels of kana text (no audio; for previews). */
    speakKana(S, R) {
      W.speakKana(String(S ?? ""), R);
    },
    holdMouth(S) {
      W.holdMouth(S);
    },
    stopLipSync() {
      W.stopLipSync();
    },
    getLipSyncState() {
      return W.getLipSyncState();
    },
    setAutoIdle(S) {
      W.autoIdle = !!S;
    },
    setLighting(S) {
      T.setLighting(S);
    },
    getLightingStats() {
      return { ...T.lightingStats };
    },
    setAutoMotion(S) {
      W.autoMotion = !!S;
    },
    /** Hair / tassel sway multiplier (1 = default). */
    setSwayGain(S) {
      re.gain = S, j.gain = S;
    },
    setClothTuning(S, R) {
      j.setTuning(S, R);
    },
    /** Called with the motion id when a motion starts and with null when it ends. */
    onMotion(S) {
      return te.add(S), () => te.delete(S);
    },
    /** Advance the simulation by `sec` and draw (for tests / hidden tabs). */
    advance(S, R = 60) {
      if (!q)
        if (S === 0) Z(0);
        else for (let P = 0; P < Math.round(S * R); P++) Z(1 / R);
    },
    /** Update motion and lip sync without drawing a hidden preview. */
    advanceParameters(S) {
      q || $(S);
    },
    destroy() {
      q || (q = !0, cancelAnimationFrame(_), te.clear(), T.destroy());
    }
  };
}
const So = Object.keys(Ot);
async function qr(e, t) {
  return Gr(e, { ...t, rig: en(t.rig) });
}
function tt(e) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("avatar.json: expected an object");
  const t = e, n = [];
  t.format !== "mesh-avatar" && n.push('avatar.json.format: expected "mesh-avatar"'), t.version !== 1 && n.push(`avatar.json.version: unsupported version ${JSON.stringify(t.version) ?? "missing"} (expected 1)`), (typeof t.name != "string" || !t.name.trim()) && n.push("avatar.json.name: expected a non-empty string");
  const r = { format: "mesh-avatar", version: 1, name: t.name };
  for (const o of ["author", "license", "thumbnail", "source"])
    t[o] !== void 0 && (typeof t[o] != "string" ? n.push(`avatar.json.${o}: expected a string`) : r[o] = t[o]);
  if (t.studio !== void 0) {
    const o = t.studio;
    !o || typeof o != "object" || Array.isArray(o) || !("version" in o) || typeof o.version != "string" || !o.version.trim() ? n.push("avatar.json.studio.version: expected a non-empty string") : r.studio = { version: o.version };
  }
  if (t.lipSync !== void 0)
    try {
      r.lipSync = tn(t.lipSync);
    } catch (o) {
      n.push(`avatar.json.lipSync: ${o instanceof Error ? o.message : String(o)}`);
    }
  if (t.expressions !== void 0)
    try {
      r.expressions = on(t.expressions);
    } catch (o) {
      n.push(`avatar.json.expressions: ${o instanceof Error ? o.message : String(o)}`);
    }
  if (n.length) throw new Error(n.join(`
`));
  return r;
}
function Yn(e) {
  return tt({ format: "mesh-avatar", version: 1, name: e });
}
const Mt = (e) => !!e && typeof e == "object" && !Array.isArray(e), We = (e, t) => Array.isArray(e) && e.length === t && e.every((n) => typeof n == "number" && Number.isFinite(n)), It = (e, t) => Object.hasOwn(e, t);
function In(e) {
  const t = [];
  function n(f, h = !0) {
    if (!It(e, f)) {
      h && t.push(`${f}: missing file`);
      return;
    }
    const p = e[f];
    if (!(p instanceof Uint8Array)) {
      t.push(`${f}: JSON bytes are required`);
      return;
    }
    let g;
    try {
      g = JSON.parse(new TextDecoder("utf-8", { fatal: !0 }).decode(p));
    } catch {
      t.push(`${f}: invalid UTF-8 JSON`);
      return;
    }
    if (!Mt(g)) {
      t.push(`${f}: expected an object`);
      return;
    }
    return g;
  }
  function r(f, h, p = !0) {
    return f.version === 1 || p && f.version === void 0 ? !0 : (t.push(`${h}.version: unsupported version ${JSON.stringify(f.version) ?? "missing"} (expected 1)`), !1);
  }
  function o(f) {
    if (!It(e, f)) {
      t.push(`${f}: missing file`);
      return;
    }
    const h = e[f], p = h instanceof Uint8Array ? h.byteLength : h?.size;
    (!Number.isSafeInteger(p) || p <= 0) && t.push(`${f}: expected a non-empty file`);
  }
  function s(f, h, p, g) {
    if (!Mt(f)) {
      t.push(`${h}.layers: expected a layer rectangle map`);
      return;
    }
    for (const [b, a] of Object.entries(f)) {
      const d = `${h}.layers.${b}`;
      if (!/^[A-Za-z0-9_-]+$/.test(b)) {
        t.push(`${d}: expected a safe layer name (letters, digits, hyphens or underscores)`);
        continue;
      }
      !We(a, 4) || !a.every(Number.isInteger) || a[0] < 0 || a[1] < 0 || a[2] <= 0 || a[3] <= 0 ? t.push(`${d}: expected [x, y, width, height] with non-negative integer origins and positive integer dimensions`) : g && (a[0] + a[2] > g[0] || a[1] + a[3] > g[1]) && t.push(`${d}: rectangle must stay inside the image`), o(`${p}/${b}.png`);
    }
    return f;
  }
  function i(f, h) {
    (typeof f.build != "string" || !f.build.trim()) && t.push(`${h}.build: expected a non-empty string`);
  }
  const u = n("avatar.json", !1);
  if (u)
    try {
      tt(u);
    } catch (f) {
      t.push(f.message);
    }
  const y = n("rig.json");
  let v;
  if (y && r(y, "rig.json", !1)) {
    const f = Ln(y);
    t.push(...f.map((h) => `rig.json: ${h}`)), f.length || (v = y);
  }
  o("built/base.png"), o("built/hairmask.png"), v?.cloth?.length && o("built/base_cloth.png");
  const m = n("built/layers.json");
  if (m && r(m, "built/layers.json")) {
    i(m, "built/layers.json");
    let f;
    !We(m.size, 2) || !m.size.every((p) => Number.isInteger(p) && p > 0) ? t.push("built/layers.json.size: expected [width, height] with positive integer dimensions") : (f = m.size, v && (f[0] !== v.image.width || f[1] !== v.image.height) && t.push("built/layers.json.size: must match rig.json.image"));
    const h = s(m.layers, "built/layers.json", "built", f);
    if (v && h) {
      const p = [
        ...v.eyes.flatMap((g, b) => ["ball", "low", "crease", "lash"].map((a) => `eye${b}_${a}`)),
        ...v.hand ? ["hand"] : [],
        ...(v.accessories ?? []).map((g) => g.name),
        ...(v.cloth ?? []).map((g) => `cloth_${g.name}`)
      ];
      for (const g of p) It(h, g) || t.push(`built/layers.json.layers.${g}: missing required layer`);
    }
    !Array.isArray(m.eyes) || m.eyes.length !== 2 ? t.push("built/layers.json.eyes: expected two eye curves") : m.eyes.forEach((p, g) => {
      const b = `built/layers.json.eyes[${g}]`;
      if (!Mt(p)) {
        t.push(`${b}: expected an object`);
        return;
      }
      We([p.x0, p.x1], 2) && p.x0 < p.x1 || t.push(`${b}: expected finite x0 < x1`);
      for (const d of ["top", "bot"])
        We(p[d], 24) || t.push(`${b}.${d}: expected 24 finite numbers`);
      if (We(p.top, 24) && We(p.bot, 24) && p.top.some((d, x) => d > p.bot[x]) && t.push(`${b}.top: must not exceed bottom curve`), v) for (const d of ["x0", "x1", "top", "bot"]) {
        const x = p[d], w = v.eyes[g][d];
        (Array.isArray(w) ? We(x, w.length) && x.every((L, z) => L === w[z]) : x === w) || t.push(`${b}.${d}: must match rig.json.eyes[${g}].${d}`);
      }
    });
  }
  const l = n("built/sprites/sprites.json", !1);
  l && r(l, "built/sprites/sprites.json") && (i(l, "built/sprites/sprites.json"), s(l.layers, "built/sprites/sprites.json", "built/sprites", v ? [v.image.width, v.image.height] : void 0));
  const c = n("built/overlays/overlays.json", !1);
  if (c && r(c, "built/overlays/overlays.json"))
    if (!Array.isArray(c.overlays)) t.push("built/overlays/overlays.json.overlays: expected an array");
    else {
      const f = /* @__PURE__ */ new Set();
      for (const [h, p] of c.overlays.entries()) {
        const g = `built/overlays/overlays.json.overlays[${h}]`;
        if (!Mt(p) || typeof p.name != "string" || !/^[A-Za-z0-9_-]+$/.test(p.name) || typeof p.file != "string" || !/^[A-Za-z0-9_-]+\.png$/.test(p.file)) {
          t.push(`${g}: expected { name, file } with safe names`);
          continue;
        }
        f.has(p.name) && t.push(`${g}.name: duplicate overlay name`), f.add(p.name), o(`built/overlays/${p.file}`);
      }
    }
  return t;
}
var ge = Uint8Array, Re = Uint16Array, sn = Int32Array, Tt = new ge([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]), Rt = new ge([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]), Ht = new ge([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), Nn = function(e, t) {
  for (var n = new Re(31), r = 0; r < 31; ++r)
    n[r] = t += 1 << e[r - 1];
  for (var o = new sn(n[30]), r = 1; r < 30; ++r)
    for (var s = n[r]; s < n[r + 1]; ++s)
      o[s] = s - n[r] << 5 | r;
  return { b: n, r: o };
}, Xn = Nn(Tt, 2), zn = Xn.b, Vt = Xn.r;
zn[28] = 258, Vt[258] = 28;
var Cn = Nn(Rt, 0), Jr = Cn.b, An = Cn.r, Zt = new Re(32768);
for (var fe = 0; fe < 32768; ++fe) {
  var He = (fe & 43690) >> 1 | (fe & 21845) << 1;
  He = (He & 52428) >> 2 | (He & 13107) << 2, He = (He & 61680) >> 4 | (He & 3855) << 4, Zt[fe] = ((He & 65280) >> 8 | (He & 255) << 8) >> 1;
}
var Ne = (function(e, t, n) {
  for (var r = e.length, o = 0, s = new Re(t); o < r; ++o)
    e[o] && ++s[e[o] - 1];
  var i = new Re(t);
  for (o = 1; o < t; ++o)
    i[o] = i[o - 1] + s[o - 1] << 1;
  var u;
  if (n) {
    u = new Re(1 << t);
    var y = 15 - t;
    for (o = 0; o < r; ++o)
      if (e[o])
        for (var v = o << 4 | e[o], m = t - e[o], l = i[e[o] - 1]++ << m, c = l | (1 << m) - 1; l <= c; ++l)
          u[Zt[l] >> y] = v;
  } else
    for (u = new Re(r), o = 0; o < r; ++o)
      e[o] && (u[o] = Zt[i[e[o] - 1]++] >> 15 - e[o]);
  return u;
}), Ve = new ge(288);
for (var fe = 0; fe < 144; ++fe)
  Ve[fe] = 8;
for (var fe = 144; fe < 256; ++fe)
  Ve[fe] = 9;
for (var fe = 256; fe < 280; ++fe)
  Ve[fe] = 7;
for (var fe = 280; fe < 288; ++fe)
  Ve[fe] = 8;
var dt = new ge(32);
for (var fe = 0; fe < 32; ++fe)
  dt[fe] = 5;
var Kr = /* @__PURE__ */ Ne(Ve, 9, 0), Qr = /* @__PURE__ */ Ne(Ve, 9, 1), eo = /* @__PURE__ */ Ne(dt, 5, 0), to = /* @__PURE__ */ Ne(dt, 5, 1), Nt = function(e) {
  for (var t = e[0], n = 1; n < e.length; ++n)
    e[n] > t && (t = e[n]);
  return t;
}, je = function(e, t, n) {
  var r = t / 8 | 0;
  return (e[r] | e[r + 1] << 8) >> (t & 7) & n;
}, Xt = function(e, t) {
  var n = t / 8 | 0;
  return (e[n] | e[n + 1] << 8 | e[n + 2] << 16) >> (t & 7);
}, an = function(e) {
  return (e + 7) / 8 | 0;
}, gt = function(e, t, n) {
  return (t == null || t < 0) && (t = 0), (n == null || n > e.length) && (n = e.length), new ge(e.subarray(t, n));
}, no = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
], xe = function(e, t, n) {
  var r = new Error(t || no[e]);
  if (r.code = e, Error.captureStackTrace && Error.captureStackTrace(r, xe), !n)
    throw r;
  return r;
}, ro = function(e, t, n, r) {
  var o = e.length, s = r ? r.length : 0;
  if (!o || t.f && !t.l)
    return n || new ge(0);
  var i = !n, u = i || t.i != 2, y = t.i;
  i && (n = new ge(o * 3));
  var v = function(O) {
    var k = n.length;
    if (O > k) {
      var $ = new ge(Math.max(k * 2, O));
      $.set(n), n = $;
    }
  }, m = t.f || 0, l = t.p || 0, c = t.b || 0, f = t.l, h = t.d, p = t.m, g = t.n, b = o * 8;
  do {
    if (!f) {
      m = je(e, l, 1);
      var a = je(e, l + 1, 3);
      if (l += 3, a)
        if (a == 1)
          f = Qr, h = to, p = 9, g = 5;
        else if (a == 2) {
          var A = je(e, l, 31) + 257, L = je(e, l + 10, 15) + 4, z = A + je(e, l + 5, 31) + 1;
          l += 14;
          for (var Y = new ge(z), I = new ge(19), U = 0; U < L; ++U)
            I[Ht[U]] = je(e, l + U * 3, 7);
          l += L * 3;
          for (var T = Nt(I), F = (1 << T) - 1, j = Ne(I, T, 1), U = 0; U < z; ) {
            var C = j[je(e, l, F)];
            l += C & 15;
            var d = C >> 4;
            if (d < 16)
              Y[U++] = d;
            else {
              var B = 0, H = 0;
              for (d == 16 ? (H = 3 + je(e, l, 3), l += 2, B = Y[U - 1]) : d == 17 ? (H = 3 + je(e, l, 7), l += 3) : d == 18 && (H = 11 + je(e, l, 127), l += 7); H--; )
                Y[U++] = B;
            }
          }
          var N = Y.subarray(0, A), ne = Y.subarray(A);
          p = Nt(N), g = Nt(ne), f = Ne(N, p, 1), h = Ne(ne, g, 1);
        } else
          xe(1);
      else {
        var d = an(l) + 4, x = e[d - 4] | e[d - 3] << 8, w = d + x;
        if (w > o) {
          y && xe(0);
          break;
        }
        u && v(c + x), n.set(e.subarray(d, w), c), t.b = c += x, t.p = l = w * 8, t.f = m;
        continue;
      }
      if (l > b) {
        y && xe(0);
        break;
      }
    }
    u && v(c + 131072);
    for (var Q = (1 << p) - 1, J = (1 << g) - 1, X = l; ; X = l) {
      var B = f[Xt(e, l) & Q], G = B >> 4;
      if (l += B & 15, l > b) {
        y && xe(0);
        break;
      }
      if (B || xe(2), G < 256)
        n[c++] = G;
      else if (G == 256) {
        X = l, f = null;
        break;
      } else {
        var re = G - 254;
        if (G > 264) {
          var U = G - 257, W = Tt[U];
          re = je(e, l, (1 << W) - 1) + zn[U], l += W;
        }
        var te = h[Xt(e, l) & J], ae = te >> 4;
        te || xe(3), l += te & 15;
        var ne = Jr[ae];
        if (ae > 3) {
          var W = Rt[ae];
          ne += Xt(e, l) & (1 << W) - 1, l += W;
        }
        if (l > b) {
          y && xe(0);
          break;
        }
        u && v(c + 131072);
        var V = c + re;
        if (c < ne) {
          var M = s - ne, E = Math.min(ne, V);
          for (M + c < 0 && xe(3); c < E; ++c)
            n[c] = r[M + c];
        }
        for (; c < V; ++c)
          n[c] = n[c - ne];
      }
    }
    t.l = f, t.p = X, t.b = c, t.f = m, f && (m = 1, t.m = p, t.d = h, t.n = g);
  } while (!m);
  return c != n.length && i ? gt(n, 0, c) : n.subarray(0, c);
}, Ce = function(e, t, n) {
  n <<= t & 7;
  var r = t / 8 | 0;
  e[r] |= n, e[r + 1] |= n >> 8;
}, ht = function(e, t, n) {
  n <<= t & 7;
  var r = t / 8 | 0;
  e[r] |= n, e[r + 1] |= n >> 8, e[r + 2] |= n >> 16;
}, zt = function(e, t) {
  for (var n = [], r = 0; r < e.length; ++r)
    e[r] && n.push({ s: r, f: e[r] });
  var o = n.length, s = n.slice();
  if (!o)
    return { t: Pn, l: 0 };
  if (o == 1) {
    var i = new ge(n[0].s + 1);
    return i[n[0].s] = 1, { t: i, l: 1 };
  }
  n.sort(function(w, A) {
    return w.f - A.f;
  }), n.push({ s: -1, f: 25001 });
  var u = n[0], y = n[1], v = 0, m = 1, l = 2;
  for (n[0] = { s: -1, f: u.f + y.f, l: u, r: y }; m != o - 1; )
    u = n[n[v].f < n[l].f ? v++ : l++], y = n[v != m && n[v].f < n[l].f ? v++ : l++], n[m++] = { s: -1, f: u.f + y.f, l: u, r: y };
  for (var c = s[0].s, r = 1; r < o; ++r)
    s[r].s > c && (c = s[r].s);
  var f = new Re(c + 1), h = Wt(n[m - 1], f, 0);
  if (h > t) {
    var r = 0, p = 0, g = h - t, b = 1 << g;
    for (s.sort(function(A, L) {
      return f[L.s] - f[A.s] || A.f - L.f;
    }); r < o; ++r) {
      var a = s[r].s;
      if (f[a] > t)
        p += b - (1 << h - f[a]), f[a] = t;
      else
        break;
    }
    for (p >>= g; p > 0; ) {
      var d = s[r].s;
      f[d] < t ? p -= 1 << t - f[d]++ - 1 : ++r;
    }
    for (; r >= 0 && p; --r) {
      var x = s[r].s;
      f[x] == t && (--f[x], ++p);
    }
    h = t;
  }
  return { t: new ge(f), l: h };
}, Wt = function(e, t, n) {
  return e.s == -1 ? Math.max(Wt(e.l, t, n + 1), Wt(e.r, t, n + 1)) : t[e.s] = n;
}, En = function(e) {
  for (var t = e.length; t && !e[--t]; )
    ;
  for (var n = new Re(++t), r = 0, o = e[0], s = 1, i = function(y) {
    n[r++] = y;
  }, u = 1; u <= t; ++u)
    if (e[u] == o && u != t)
      ++s;
    else {
      if (!o && s > 2) {
        for (; s > 138; s -= 138)
          i(32754);
        s > 2 && (i(s > 10 ? s - 11 << 5 | 28690 : s - 3 << 5 | 12305), s = 0);
      } else if (s > 3) {
        for (i(o), --s; s > 6; s -= 6)
          i(8304);
        s > 2 && (i(s - 3 << 5 | 8208), s = 0);
      }
      for (; s--; )
        i(o);
      s = 1, o = e[u];
    }
  return { c: n.subarray(0, r), n: t };
}, ut = function(e, t) {
  for (var n = 0, r = 0; r < t.length; ++r)
    n += e[r] * t[r];
  return n;
}, Dn = function(e, t, n) {
  var r = n.length, o = an(t + 2);
  e[o] = r & 255, e[o + 1] = r >> 8, e[o + 2] = e[o] ^ 255, e[o + 3] = e[o + 1] ^ 255;
  for (var s = 0; s < r; ++s)
    e[o + s + 4] = n[s];
  return (o + 4 + r) * 8;
}, Sn = function(e, t, n, r, o, s, i, u, y, v, m) {
  Ce(t, m++, n), ++o[256];
  for (var l = zt(o, 15), c = l.t, f = l.l, h = zt(s, 15), p = h.t, g = h.l, b = En(c), a = b.c, d = b.n, x = En(p), w = x.c, A = x.n, L = new Re(19), z = 0; z < a.length; ++z)
    ++L[a[z] & 31];
  for (var z = 0; z < w.length; ++z)
    ++L[w[z] & 31];
  for (var Y = zt(L, 7), I = Y.t, U = Y.l, T = 19; T > 4 && !I[Ht[T - 1]]; --T)
    ;
  var F = v + 5 << 3, j = ut(o, Ve) + ut(s, dt) + i, C = ut(o, c) + ut(s, p) + i + 14 + 3 * T + ut(L, I) + 2 * L[16] + 3 * L[17] + 7 * L[18];
  if (y >= 0 && F <= j && F <= C)
    return Dn(t, m, e.subarray(y, y + v));
  var B, H, N, ne;
  if (Ce(t, m, 1 + (C < j)), m += 2, C < j) {
    B = Ne(c, f, 0), H = c, N = Ne(p, g, 0), ne = p;
    var Q = Ne(I, U, 0);
    Ce(t, m, d - 257), Ce(t, m + 5, A - 1), Ce(t, m + 10, T - 4), m += 14;
    for (var z = 0; z < T; ++z)
      Ce(t, m + 3 * z, I[Ht[z]]);
    m += 3 * T;
    for (var J = [a, w], X = 0; X < 2; ++X)
      for (var G = J[X], z = 0; z < G.length; ++z) {
        var re = G[z] & 31;
        Ce(t, m, Q[re]), m += I[re], re > 15 && (Ce(t, m, G[z] >> 5 & 127), m += G[z] >> 12);
      }
  } else
    B = Kr, H = Ve, N = eo, ne = dt;
  for (var z = 0; z < u; ++z) {
    var W = r[z];
    if (W > 255) {
      var re = W >> 18 & 31;
      ht(t, m, B[re + 257]), m += H[re + 257], re > 7 && (Ce(t, m, W >> 23 & 31), m += Tt[re]);
      var te = W & 31;
      ht(t, m, N[te]), m += ne[te], te > 3 && (ht(t, m, W >> 5 & 8191), m += Rt[te]);
    } else
      ht(t, m, B[W]), m += H[W];
  }
  return ht(t, m, B[256]), m + H[256];
}, oo = /* @__PURE__ */ new sn([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]), Pn = /* @__PURE__ */ new ge(0), so = function(e, t, n, r, o, s) {
  var i = s.z || e.length, u = new ge(r + i + 5 * (1 + Math.ceil(i / 7e3)) + o), y = u.subarray(r, u.length - o), v = s.l, m = (s.r || 0) & 7;
  if (t) {
    m && (y[0] = s.r >> 3);
    for (var l = oo[t - 1], c = l >> 13, f = l & 8191, h = (1 << n) - 1, p = s.p || new Re(32768), g = s.h || new Re(h + 1), b = Math.ceil(n / 3), a = 2 * b, d = function(Z) {
      return (e[Z] ^ e[Z + 1] << b ^ e[Z + 2] << a) & h;
    }, x = new sn(25e3), w = new Re(288), A = new Re(32), L = 0, z = 0, Y = s.i || 0, I = 0, U = s.w || 0, T = 0; Y + 2 < i; ++Y) {
      var F = d(Y), j = Y & 32767, C = g[F];
      if (p[j] = C, g[F] = j, U <= Y) {
        var B = i - Y;
        if ((L > 7e3 || I > 24576) && (B > 423 || !v)) {
          m = Sn(e, y, 0, x, w, A, z, I, T, Y - T, m), I = L = z = 0, T = Y;
          for (var H = 0; H < 286; ++H)
            w[H] = 0;
          for (var H = 0; H < 30; ++H)
            A[H] = 0;
        }
        var N = 2, ne = 0, Q = f, J = j - C & 32767;
        if (B > 2 && F == d(Y - J))
          for (var X = Math.min(c, B) - 1, G = Math.min(32767, Y), re = Math.min(258, B); J <= G && --Q && j != C; ) {
            if (e[Y + N] == e[Y + N - J]) {
              for (var W = 0; W < re && e[Y + W] == e[Y + W - J]; ++W)
                ;
              if (W > N) {
                if (N = W, ne = J, W > X)
                  break;
                for (var te = Math.min(J, W - 2), ae = 0, H = 0; H < te; ++H) {
                  var V = Y - J + H & 32767, M = p[V], E = V - M & 32767;
                  E > ae && (ae = E, C = V);
                }
              }
            }
            j = C, C = p[j], J += j - C & 32767;
          }
        if (ne) {
          x[I++] = 268435456 | Vt[N] << 18 | An[ne];
          var O = Vt[N] & 31, k = An[ne] & 31;
          z += Tt[O] + Rt[k], ++w[257 + O], ++A[k], U = Y + N, ++L;
        } else
          x[I++] = e[Y], ++w[e[Y]];
      }
    }
    for (Y = Math.max(Y, U); Y < i; ++Y)
      x[I++] = e[Y], ++w[e[Y]];
    m = Sn(e, y, v, x, w, A, z, I, T, Y - T, m), v || (s.r = m & 7 | y[m / 8 | 0] << 3, m -= 7, s.h = g, s.p = p, s.i = Y, s.w = U);
  } else {
    for (var Y = s.w || 0; Y < i + v; Y += 65535) {
      var $ = Y + 65535;
      $ >= i && (y[m / 8 | 0] = v, $ = i), m = Dn(y, m + 1, e.subarray(Y, $));
    }
    s.i = i;
  }
  return gt(u, 0, r + an(m) + o);
}, ao = /* @__PURE__ */ (function() {
  for (var e = new Int32Array(256), t = 0; t < 256; ++t) {
    for (var n = t, r = 9; --r; )
      n = (n & 1 && -306674912) ^ n >>> 1;
    e[t] = n;
  }
  return e;
})(), io = function() {
  var e = -1;
  return {
    p: function(t) {
      for (var n = e, r = 0; r < t.length; ++r)
        n = ao[n & 255 ^ t[r]] ^ n >>> 8;
      e = n;
    },
    d: function() {
      return ~e;
    }
  };
}, lo = function(e, t, n, r, o) {
  if (!o && (o = { l: 1 }, t.dictionary)) {
    var s = t.dictionary.subarray(-32768), i = new ge(s.length + e.length);
    i.set(s), i.set(e, s.length), e = i, o.w = s.length;
  }
  return so(e, t.level == null ? 6 : t.level, t.mem == null ? o.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(e.length))) * 1.5) : 20 : 12 + t.mem, n, r, o);
}, Hn = function(e, t) {
  var n = {};
  for (var r in e)
    n[r] = e[r];
  for (var r in t)
    n[r] = t[r];
  return n;
}, Ie = function(e, t) {
  return e[t] | e[t + 1] << 8;
}, Fe = function(e, t) {
  return (e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24) >>> 0;
}, Ct = function(e, t) {
  return Fe(e, t) + Fe(e, t + 4) * 4294967296;
}, ve = function(e, t, n) {
  for (; n; ++t)
    e[t] = n, n >>>= 8;
};
function co(e, t) {
  return lo(e, t || {}, 0, 0);
}
function ho(e, t) {
  return ro(e, { i: 2 }, t && t.out, t && t.dictionary);
}
var Vn = function(e, t, n, r) {
  for (var o in e) {
    var s = e[o], i = t + o, u = r;
    Array.isArray(s) && (u = Hn(r, s[1]), s = s[0]), ArrayBuffer.isView(s) ? n[i] = [s, u] : (n[i += "/"] = [new ge(0), u], Vn(s, i, n, r));
  }
}, On = typeof TextEncoder < "u" && /* @__PURE__ */ new TextEncoder(), Gt = typeof TextDecoder < "u" && /* @__PURE__ */ new TextDecoder(), uo = 0;
try {
  Gt.decode(Pn, { stream: !0 }), uo = 1;
} catch {
}
var fo = function(e) {
  for (var t = "", n = 0; ; ) {
    var r = e[n++], o = (r > 127) + (r > 223) + (r > 239);
    if (n + o > e.length)
      return { s: t, r: gt(e, n - 1) };
    o ? o == 3 ? (r = ((r & 15) << 18 | (e[n++] & 63) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) - 65536, t += String.fromCharCode(55296 | r >> 10, 56320 | r & 1023)) : o & 1 ? t += String.fromCharCode((r & 31) << 6 | e[n++] & 63) : t += String.fromCharCode((r & 15) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) : t += String.fromCharCode(r);
  }
};
function Tn(e, t) {
  var n;
  if (On)
    return On.encode(e);
  for (var r = e.length, o = new ge(e.length + (e.length >> 1)), s = 0, i = function(v) {
    o[s++] = v;
  }, n = 0; n < r; ++n) {
    if (s + 5 > o.length) {
      var u = new ge(s + 8 + (r - n << 1));
      u.set(o), o = u;
    }
    var y = e.charCodeAt(n);
    y < 128 || t ? i(y) : y < 2048 ? (i(192 | y >> 6), i(128 | y & 63)) : y > 55295 && y < 57344 ? (y = 65536 + (y & 1047552) | e.charCodeAt(++n) & 1023, i(240 | y >> 18), i(128 | y >> 12 & 63), i(128 | y >> 6 & 63), i(128 | y & 63)) : (i(224 | y >> 12), i(128 | y >> 6 & 63), i(128 | y & 63));
  }
  return gt(o, 0, s);
}
function mo(e, t) {
  if (t) {
    for (var n = "", r = 0; r < e.length; r += 16384)
      n += String.fromCharCode.apply(null, e.subarray(r, r + 16384));
    return n;
  } else {
    if (Gt)
      return Gt.decode(e);
    var o = fo(e), s = o.s, n = o.r;
    return n.length && xe(8), s;
  }
}
var po = function(e, t) {
  return t + 30 + Ie(e, t + 26) + Ie(e, t + 28);
}, go = function(e, t, n) {
  var r = Ie(e, t + 28), o = Ie(e, t + 30), s = mo(e.subarray(t + 46, t + 46 + r), !(Ie(e, t + 8) & 2048)), i = t + 46 + r, u = yo(e, i, o, n, Fe(e, t + 20), Fe(e, t + 24), Fe(e, t + 42)), y = u[0], v = u[1], m = u[2];
  return [Ie(e, t + 10), y, v, s, i + o + Ie(e, t + 32), m];
}, yo = function(e, t, n, r, o, s, i) {
  var u = o == 4294967295, y = s == 4294967295, v = i == 4294967295, m = t + n, l = u + y + v;
  if (r && l) {
    for (; t + 4 < m; t += 4 + Ie(e, t + 2))
      if (Ie(e, t) == 1)
        return [
          u ? Ct(e, t + 4 + 8 * y) : o,
          y ? Ct(e, t + 4) : s,
          v ? Ct(e, t + 4 + 8 * (y + u)) : i,
          1
        ];
    r < 2 && xe(13);
  }
  return [o, s, i, 0];
}, qt = function(e) {
  var t = 0;
  if (e)
    for (var n in e) {
      var r = e[n].length;
      r > 65535 && xe(9), t += r + 4;
    }
  return t;
}, Rn = function(e, t, n, r, o, s, i, u) {
  var y = r.length, v = n.extra, m = u && u.length, l = qt(v);
  ve(e, t, i != null ? 33639248 : 67324752), t += 4, i != null && (e[t++] = 20, e[t++] = n.os), e[t] = 20, t += 2, e[t++] = n.flag << 1 | (s < 0 && 8), e[t++] = o && 8, e[t++] = n.compression & 255, e[t++] = n.compression >> 8;
  var c = new Date(n.mtime == null ? Date.now() : n.mtime), f = c.getFullYear() - 1980;
  if ((f < 0 || f > 119) && xe(10), ve(e, t, f << 25 | c.getMonth() + 1 << 21 | c.getDate() << 16 | c.getHours() << 11 | c.getMinutes() << 5 | c.getSeconds() >> 1), t += 4, s != -1 && (ve(e, t, n.crc), ve(e, t + 4, s < 0 ? -s - 2 : s), ve(e, t + 8, n.size)), ve(e, t + 12, y), ve(e, t + 14, l), t += 16, i != null && (ve(e, t, m), ve(e, t + 6, n.attrs), ve(e, t + 10, i), t += 14), e.set(r, t), t += y, l)
    for (var h in v) {
      var p = v[h], g = p.length;
      ve(e, t, +h), ve(e, t + 2, g), e.set(p, t + 4), t += 4 + g;
    }
  return m && (e.set(u, t), t += m), t;
}, vo = function(e, t, n, r, o) {
  ve(e, t, 101010256), ve(e, t + 8, n), ve(e, t + 10, n), ve(e, t + 12, r), ve(e, t + 16, o);
};
function bo(e, t) {
  t || (t = {});
  var n = {}, r = [];
  Vn(e, "", n, t);
  var o = 0, s = 0;
  for (var i in n) {
    var u = n[i], y = u[0], v = u[1], m = v.level == 0 ? 0 : 8, l = Tn(i), c = l.length, f = v.comment, h = f && Tn(f), p = h && h.length, g = qt(v.extra);
    c > 65535 && xe(11);
    var b = m ? co(y, v) : y, a = b.length, d = io();
    d.p(y), r.push(Hn(v, {
      size: y.length,
      crc: d.d(),
      c: b,
      f: l,
      m: h,
      u: c != i.length || h && f.length != p,
      o,
      compression: m
    })), o += 30 + c + g + a, s += 76 + 2 * (c + g) + (p || 0) + a;
  }
  for (var x = new ge(s + 22), w = o, A = s - o, L = 0; L < r.length; ++L) {
    var l = r[L];
    Rn(x, l.o, l, l.f, l.u, l.c.length);
    var z = 30 + l.f.length + qt(l.extra);
    x.set(l.c, l.o + z), Rn(x, o, l, l.f, l.u, l.c.length, l.o, l.m), o += 16 + z + (l.m ? l.m.length : 0);
  }
  return vo(x, o, r.length, A, w), x;
}
function wo(e, t) {
  for (var n = {}, r = e.length - 22; Fe(e, r) != 101010256; --r)
    (!r || e.length - r > 65558) && xe(13);
  var o = Ie(e, r + 8);
  if (!o)
    return {};
  var s = Fe(e, r + 16), i = Fe(e, r - 20) == 117853008;
  if (i) {
    var u = Fe(e, r - 12);
    i = Fe(e, u) == 101075792, i && (o = Fe(e, u + 32), s = Fe(e, u + 48));
  }
  for (var y = t && t.filter, v = 0; v < o; ++v) {
    var m = go(e, s, i), l = m[0], c = m[1], f = m[2], h = m[3], p = m[4], g = m[5], b = po(e, g);
    s = p, (!y || y({
      name: h,
      size: c,
      originalSize: f,
      compression: l
    })) && (l ? l == 8 ? n[h] = ho(e.subarray(b, b + c), { out: new ge(f) }) : xe(14, "unknown compression type " + l) : n[h] = gt(e, b, b + c));
  }
  return n;
}
const St = 200, Jt = 64 * 1024 * 1024, Kt = new TextDecoder("utf-8", { fatal: !0 });
function ln(e) {
  if (!e || e.startsWith("/") || /^[A-Za-z]:/.test(e) || e.includes("\\") || e.includes("\0") || e.split("/").includes(".."))
    throw new Error(`ZIP entry ${JSON.stringify(e)}: path must be relative, without .. or backslashes`);
}
function Qt(e) {
  const t = new DataView(e.buffer, e.byteOffset, e.byteLength), n = (c = "(archive)") => {
    throw new Error(`ZIP entry ${JSON.stringify(c)}: invalid or truncated ZIP`);
  }, r = (c) => c >= 0 && c + 2 <= e.length ? t.getUint16(c, !0) : n(), o = (c) => c >= 0 && c + 4 <= e.length ? t.getUint32(c, !0) : n();
  let s = e.length - 22;
  for (; s >= Math.max(0, e.length - 65557) && !(o(s) === 101010256 && s + 22 + r(s + 20) === e.length); s--)
    ;
  (s < 0 || s < e.length - 65557) && n(), (r(s + 4) || r(s + 6) || r(s + 8) !== r(s + 10)) && n();
  const i = r(s + 10), u = o(s + 16), y = u + o(s + 12);
  y !== s && n();
  const v = [], m = /* @__PURE__ */ new Set();
  let l = u;
  for (let c = 0; c < i; c++) {
    (l + 46 > y || o(l) !== 33639248) && n();
    const f = r(l + 28), h = l + 46 + f + r(l + 30) + r(l + 32);
    h > y && n();
    let p;
    try {
      p = Kt.decode(e.subarray(l + 46, l + 46 + f));
    } catch {
      throw new Error("ZIP entry (invalid UTF-8 name): invalid filename");
    }
    if (ln(p), c >= St) throw new Error(`ZIP entry ${JSON.stringify(p)}: more than ${St} entries`);
    if (m.has(p)) throw new Error(`ZIP entry ${JSON.stringify(p)}: duplicate entry`);
    m.add(p);
    const g = o(l + 24), b = o(l + 20), a = o(l + 42);
    if (g > Jt || b > Jt) throw new Error(`ZIP entry ${JSON.stringify(p)}: exceeds 64 MB`);
    if (r(l + 10) !== 0) throw new Error(`ZIP entry ${JSON.stringify(p)}: expected stored compression (method 0)`);
    if (r(l + 8) & 1) throw new Error(`ZIP entry ${JSON.stringify(p)}: encrypted entries are not supported`);
    (b !== g || a + 30 > u || o(a) !== 67324752) && n(p);
    const d = a + 30 + r(a + 26) + r(a + 28);
    (d + g > u || r(a + 8) !== 0 || r(a + 6) !== r(l + 8)) && n(p);
    let x;
    try {
      x = Kt.decode(e.subarray(a + 30, a + 30 + r(a + 26)));
    } catch {
      n(p);
    }
    x !== p && n(p), v.push({ name: p, offset: a, start: d, size: g, central: l }), l = h;
  }
  return l !== y && n(), { files: v };
}
function xo(e) {
  const t = e instanceof Uint8Array ? e : new Uint8Array(e), n = Qt(t), r = wo(t, { filter: (s) => s.name !== "__proto__" }), o = /* @__PURE__ */ Object.create(null);
  for (const s of n.files) {
    const i = s.name === "__proto__" ? t.slice(s.start, s.start + s.size) : r[s.name];
    if (!(i instanceof Uint8Array) || i.length !== s.size) throw new Error(`ZIP entry ${JSON.stringify(s.name)}: invalid size`);
    o[s.name] = i;
  }
  return o;
}
function Oo(e, t = {}) {
  const n = Object.hasOwn(e, "avatar.json") ? e["avatar.json"] : void 0, r = n ? tt(JSON.parse(Kt.decode(n))) : Yn("Avatar"), o = n && !t.manifest ? n : new TextEncoder().encode(JSON.stringify(tt({ ...r, ...t.manifest }), null, 2) + `
`), s = /* @__PURE__ */ Object.create(null);
  s["avatar.json"] = o;
  for (const [c, f] of Object.entries(e)) c !== "avatar.json" && (s[c] = f);
  for (const [c, [f, h]] of Object.entries(s).entries()) {
    if (ln(f), c >= St) throw new Error(`ZIP entry ${JSON.stringify(f)}: more than ${St} entries`);
    if (h.byteLength > Jt) throw new Error(`ZIP entry ${JSON.stringify(f)}: exceeds 64 MB`);
  }
  const i = In(s);
  if (i.length) throw new Error(i.join(`
`));
  let u = "proto0000";
  for (let c = 0; Object.hasOwn(s, u); c++) u = `proto${String(c + 1).padStart(4, "0")}`;
  const y = Object.fromEntries(Object.entries(s).map(([c, f]) => [c === "__proto__" ? u : c, f])), v = bo(y, { level: 0 });
  if (Object.hasOwn(s, "__proto__")) {
    const c = Qt(v).files.find((h) => h.name === u), f = new TextEncoder().encode("__proto__");
    v.set(f, c.offset + 30), v.set(f, c.central + 46);
  }
  const m = Qt(v), l = m.files.find((c) => c.name === "avatar.json");
  if (l.offset !== 0) {
    const c = l.start + l.size - l.offset, f = new Uint8Array(v.length);
    f.set(v.subarray(l.offset, l.offset + c)), f.set(v.subarray(0, l.offset), c), f.set(v.subarray(l.offset + c), l.offset + c);
    const h = new DataView(f.buffer);
    for (const p of m.files) h.setUint32(p.central + 42, p === l ? 0 : p.offset < l.offset ? p.offset + c : p.offset, !0);
    return f;
  }
  return v;
}
const Mo = (e) => JSON.parse(new TextDecoder("utf-8", { fatal: !0 }).decode(e));
function Qe(e, t) {
  try {
    return Mo(e);
  } catch {
    throw new Error(`${t}: invalid UTF-8 JSON`);
  }
}
function Zn(e, t, n, r) {
  return [
    "layers.json",
    "base.png",
    "hairmask.png",
    ...r?.cloth?.length ? ["base_cloth.png"] : [],
    ...Object.keys(e?.layers ?? {}).map((o) => `${o}.png`),
    ...t ? ["sprites/sprites.json", ...Object.keys(t.layers ?? {}).map((o) => `sprites/${o}.png`)] : [],
    // malformed entries are left to validateAvatarFiles, which reports them
    ...n ? ["overlays/overlays.json", ...(Array.isArray(n.overlays) ? n.overlays : []).flatMap((o) => typeof o?.file == "string" ? [`overlays/${o.file}`] : [])] : []
  ];
}
function Wn(e) {
  const t = In(e);
  if (t.length) throw new Error(t.join(`
`));
}
function Gn(e) {
  return !!e && typeof e == "object" && "manifest" in e && "rig" in e && "assets" in e && "release" in e;
}
function Dt(e) {
  const t = xo(e);
  if (!Object.hasOwn(t, "avatar.json")) throw new Error("avatar.json: missing file in .mavatar archive");
  Wn(t);
  const n = tt(Qe(t["avatar.json"], "avatar.json")), r = en(Qe(t["rig.json"], "rig.json")), o = t["built/overlays/overlays.json"] ? Qe(t["built/overlays/overlays.json"], "built/overlays/overlays.json") : void 0, s = Zn(
    Qe(t["built/layers.json"], "built/layers.json"),
    t["built/sprites/sprites.json"] ? Qe(t["built/sprites/sprites.json"], "built/sprites/sprites.json") : void 0,
    o,
    r
  ), i = {}, u = [], y = () => {
    u.splice(0).forEach((v) => URL.revokeObjectURL(v));
  };
  try {
    for (const v of new Set(s)) {
      const m = URL.createObjectURL(new Blob([new Uint8Array(t[`built/${v}`])], { type: v.endsWith(".json") ? "application/json" : "image/png" }));
      u.push(m), i[v] = m;
    }
  } catch (v) {
    throw y(), v;
  }
  return { manifest: n, rig: r, assets: i, release: y };
}
async function Ao(e, t = {}) {
  if (Gn(e)) return e;
  if (e instanceof Blob) return Dt(await e.arrayBuffer());
  if (e instanceof ArrayBuffer || e instanceof Uint8Array) return Dt(e);
  const n = new URL(e, typeof location > "u" ? void 0 : location.href);
  if (/\.mavatar$/i.test(n.pathname)) {
    const g = await fetch(n);
    if (!g.ok) throw new Error(`.mavatar: could not load (${g.status})`);
    return Dt(await g.arrayBuffer());
  }
  n.pathname.endsWith("/") || (n.pathname += "/");
  const r = (g) => {
    const b = new URL(n);
    return b.pathname += g.split("/").map(encodeURIComponent).join("/"), t.version !== void 0 && b.searchParams.set("v", String(t.version)), b.href;
  }, o = {};
  async function s(g, b = !1) {
    const a = await fetch(r(g));
    if (b && (a.status === 404 || a.ok && a.headers.get("content-type")?.includes("text/html"))) return;
    if (!a.ok) throw new Error(`${g}: could not load (${a.status})`);
    const d = new Uint8Array(await a.arrayBuffer());
    return o[g] = d, Qe(d, g);
  }
  const i = t.rigFile ?? "rig.json";
  ln(i);
  const [u, y, v, m, l] = await Promise.all([
    s(i),
    s("built/layers.json"),
    s("avatar.json", !0),
    s("built/sprites/sprites.json", !0),
    s("built/overlays/overlays.json", !0)
  ]);
  Array.isArray(u?.eyes) && Array.isArray(y?.eyes) && (u.eyes = u.eyes.map((g, b) => {
    if (!g || typeof g != "object") return g;
    const a = { ...g };
    for (const d of ["x0", "x1", "top", "bot"]) a[d] === void 0 && (a[d] = y.eyes[b]?.[d]);
    return a;
  })), o["rig.json"] = new TextEncoder().encode(JSON.stringify(u));
  const c = Zn(y, m, l, u);
  for (const g of c) g.endsWith(".png") && (o[`built/${g}`] = { size: 1 });
  Wn(o);
  const f = en(u), h = Object.fromEntries(c.map((g) => [g, r(`built/${g}`)])), p = decodeURIComponent(n.pathname.split("/").filter(Boolean).at(-1) ?? "Avatar");
  return { manifest: v === void 0 ? Yn(p) : tt(v), rig: f, assets: h, release() {
  } };
}
async function To(e, t, n = {}) {
  const r = !Gn(t), o = await Ao(t);
  try {
    const s = n.lipSync === void 0 ? o.manifest.lipSync : { ...o.manifest.lipSync, ...tn(n.lipSync) }, i = n.expressions === void 0 ? o.manifest.expressions : Vr(o.manifest.expressions, on(n.expressions)), u = await qr(e, {
      ...n,
      ...s === void 0 ? {} : { lipSync: s },
      ...i === void 0 ? {} : { expressions: i },
      rig: o.rig,
      assets: o.assets
    }), y = u.destroy.bind(u);
    let v = !1;
    return Object.assign(u, { package: o, destroy() {
      if (!v) {
        v = !0;
        try {
          y();
        } finally {
          r && o.release();
        }
      }
    } });
  } catch (s) {
    throw r && o.release(), s;
  }
}
export {
  mt as ARM_DEFAULTS,
  et as DEFAULT_LIGHTING,
  So as LIVE_EXPRESSIONS,
  bt as PARAMS,
  Eo as colorHex,
  qr as createMeshAvatar,
  To as loadMeshAvatar,
  Ao as openAvatar,
  Oo as packAvatar,
  lr as parseLighting,
  tt as parseManifest,
  en as parseRig,
  xo as unpackAvatar,
  In as validateAvatarFiles,
  Ln as validateRig
};
