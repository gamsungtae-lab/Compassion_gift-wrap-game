// 절차적(코드로 그린) 텍스처 모음 — 외부 이미지 없이 고해상도 질감을 만든다.
import { THREE } from './three-deps.js';

let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = v; }

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

// 결정적 난수 (매번 같은 무늬)
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 타일 경계를 넘는 도형은 반대편에도 그려 이음새 없이 반복
function tiled(size, x, y, r, draw) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const px = x + dx, py = y + dy;
    if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
    draw(px, py);
  }
}

function star(ctx, x, y, rOut, rIn, rot = -Math.PI / 2, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = rot + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.closePath();
}

function snowflake(ctx, x, y, r, lw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.22, -r * 0.75);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.22, -r * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function grain(ctx, size, alpha, seed = 7) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 255 * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- 포장지 ----------
export const PAPER_STYLES = {
  redStars(ctx, S) {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#b0142c'); g.addColorStop(1, '#8e0f22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const r = rng(11);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = (i + (j % 2) * 0.5) * S / 4 + S / 8, y = j * S / 4 + S / 8;
      const s = S * (0.045 + r() * 0.02);
      tiled(S, x, y, s, (px, py) => {
        const gg = ctx.createLinearGradient(px - s, py - s, px + s, py + s);
        gg.addColorStop(0, '#fff2b0'); gg.addColorStop(0.5, '#e8b64a'); gg.addColorStop(1, '#b07a1e');
        ctx.fillStyle = gg; star(ctx, px, py, s, s * 0.45, -Math.PI / 2 + r() * 0.6); ctx.fill();
      });
      tiled(S, x + S / 8, y + S / 8, 4, (px, py) => {
        ctx.fillStyle = 'rgba(255,230,160,0.8)'; ctx.beginPath(); ctx.arc(px, py, S * 0.006, 0, 7); ctx.fill();
      });
    }
    grain(ctx, S, 0.04);
  },
  greenPlaid(ctx, S) {
    ctx.fillStyle = '#145a3a'; ctx.fillRect(0, 0, S, S);
    const bands = [
      [0.0, 0.18, 'rgba(10,40,25,0.55)'], [0.5, 0.18, 'rgba(10,40,25,0.55)'],
      [0.24, 0.035, 'rgba(200,30,45,0.85)'], [0.74, 0.035, 'rgba(200,30,45,0.85)'],
      [0.36, 0.012, 'rgba(240,200,90,0.9)'], [0.86, 0.012, 'rgba(240,200,90,0.9)'],
    ];
    for (const [p, w, c] of bands) {
      ctx.fillStyle = c;
      ctx.fillRect(p * S, 0, w * S, S);
      ctx.globalAlpha = 0.7; ctx.fillRect(0, p * S, S, w * S); ctx.globalAlpha = 1;
    }
    // 직조감
    ctx.globalAlpha = 0.08; ctx.strokeStyle = '#000';
    for (let i = 0; i < S; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke(); }
    ctx.globalAlpha = 1;
    grain(ctx, S, 0.05);
  },
  navySnow(ctx, S) {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, '#1d3a78'); g.addColorStop(1, '#122650');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const r = rng(23);
    ctx.strokeStyle = 'rgba(235,245,255,0.95)';
    for (let i = 0; i < 9; i++) {
      const x = r() * S, y = r() * S, s = S * (0.04 + r() * 0.05);
      tiled(S, x, y, s, (px, py) => snowflake(ctx, px, py, s, S * 0.007));
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, s = S * (0.002 + r() * 0.005);
      ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    }
    grain(ctx, S, 0.03);
  },
  candyStripe(ctx, S) {
    ctx.fillStyle = '#fbf3e6'; ctx.fillRect(0, 0, S, S);
    const period = S / 4;
    ctx.save();
    for (let k = -8; k < 8; k++) {
      const off = k * period;
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.moveTo(off, 0); ctx.lineTo(off + period * 0.42, 0); ctx.lineTo(off + period * 0.42 + S, S); ctx.lineTo(off + S, S);
      ctx.fill();
      ctx.fillStyle = '#1f7a4a';
      ctx.beginPath();
      const o2 = off + period * 0.62;
      ctx.moveTo(o2, 0); ctx.lineTo(o2 + period * 0.07, 0); ctx.lineTo(o2 + period * 0.07 + S, S); ctx.lineTo(o2 + S, S);
      ctx.fill();
    }
    ctx.restore();
    grain(ctx, S, 0.035);
  },
  blueDots(ctx, S) {
    ctx.fillStyle = '#e9eef6'; ctx.fillRect(0, 0, S, S);
    const n = 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + (j % 2) * 0.5) * S / n, y = j * S / n;
      const isHeart = (i + j) % 3 === 0;
      tiled(S, x, y, S * 0.05, (px, py) => {
        if (isHeart) { ctx.fillStyle = '#e0303f'; heartPath(ctx, px, py + S * 0.01, S * 0.045); ctx.fill(); }
        else { ctx.fillStyle = '#0a5cb8'; ctx.beginPath(); ctx.arc(px, py, S * 0.026, 0, 7); ctx.fill(); }
      });
    }
    grain(ctx, S, 0.03);
  },
  goldDamask(ctx, S) {
    ctx.fillStyle = '#5a0f22'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(232,190,100,0.85)'; ctx.lineWidth = S * 0.006;
    const n = 4, c = S / n;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = i * c, y = j * c;
      ctx.beginPath(); ctx.moveTo(x, y - c / 2); ctx.lineTo(x + c / 2, y); ctx.lineTo(x, y + c / 2); ctx.lineTo(x - c / 2, y); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(232,190,100,0.9)';
      star(ctx, x + c / 2, y + c / 2, c * 0.14, c * 0.05, 0, 4); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, c * 0.04, 0, 7); ctx.fill();
    }
    grain(ctx, S, 0.04);
  },
};

const paperCache = new Map();
export function paperTexture(style) {
  if (paperCache.has(style)) return paperCache.get(style);
  const S = 512;
  const [c, ctx] = canvas(S);
  PAPER_STYLES[style](ctx, S);
  const t = toTexture(c);
  paperCache.set(style, t);
  return t;
}

// 종이 결 (노멀 대신 범프로 사용)
let paperBumpTex;
export function paperBump() {
  if (paperBumpTex) return paperBumpTex;
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);
  grain(ctx, S, 0.25, 3);
  paperBumpTex = toTexture(c, { srgb: false });
  return paperBumpTex;
}

// ---------- 소품 ----------
export function woodTexture() {
  const W = 1024, H = 1024;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#6b3d1f'; ctx.fillRect(0, 0, W, H);
  const r = rng(5);
  for (let i = 0; i < 260; i++) {
    const y = r() * H, amp = 4 + r() * 10, alpha = 0.05 + r() * 0.12;
    ctx.strokeStyle = r() > 0.5 ? `rgba(40,18,6,${alpha})` : `rgba(150,90,45,${alpha})`;
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * amp);
    ctx.stroke();
  }
  grain(ctx, W, 0.06);
  return toTexture(c);
}

export function feltTexture(color = '#7a0f1f') {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
  grain(ctx, S, 0.12, 9);
  return toTexture(c);
}

export function furBump() {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);
  const r = rng(31);
  for (let i = 0; i < 5000; i++) {
    const x = r() * S, y = r() * S, a = r() * Math.PI * 2, l = 2 + r() * 5;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  return toTexture(c, { srgb: false });
}

export function knitTexture(colors = ['#c8102e', '#f5efe6', '#1f7a4a']) {
  const S = 256;
  const [c, ctx] = canvas(S);
  const stripes = [0, 0, 0, 1, 2, 1, 0, 0];
  const h = S / stripes.length;
  stripes.forEach((ci, i) => { ctx.fillStyle = colors[ci]; ctx.fillRect(0, i * h, S, h); });
  // 니트 V 무늬
  const vw = S / 16, vh = h / 3;
  for (let y = 0; y < S; y += vh) for (let x = 0; x < S; x += vw) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vw / 2, y + vh); ctx.lineTo(x + vw, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x + 1, y + 2); ctx.lineTo(x + vw / 2, y + vh - 1); ctx.stroke();
  }
  return toTexture(c);
}

// 축구공: 구면 보로노이(정이십면체+정십이면체 꼭짓점 = 깎은 정이십면체)로 정확한 오각/육각 패턴
export function soccerTexture() {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  const phi = (1 + Math.sqrt(5)) / 2;
  const pent = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) {
    pent.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  const hex = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) hex.push([x, y, z]);
  const ip = 1 / phi;
  for (const a of [-ip, ip]) for (const b of [-phi, phi]) hex.push([0, a, b], [a, b, 0], [b, 0, a]);
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const centers = [...pent.map((v) => [norm(v), true]), ...hex.map((v) => [norm(v), false])];
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const th = (y + 0.5) / H * Math.PI;
    const st = Math.sin(th), ct = Math.cos(th);
    for (let x = 0; x < W; x++) {
      const ph = (x + 0.5) / W * Math.PI * 2;
      const p = [-Math.cos(ph) * st, ct, Math.sin(ph) * st];
      let b1 = -2, b2 = -2, black = false;
      for (const [cv, isP] of centers) {
        const dot = p[0] * cv[0] + p[1] * cv[1] + p[2] * cv[2];
        if (dot > b1) { b2 = b1; b1 = dot; black = isP; } else if (dot > b2) b2 = dot;
      }
      const edge = b1 - b2;
      let v = black ? 28 : 246;
      if (edge < 0.012) v = black ? 60 : 150 + (edge / 0.012) * 90;
      const i = (y * W + x) * 4;
      d[i] = v; d[i + 1] = v; d[i + 2] = black ? v + 4 : v; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: false });
}

export function bookCoverTexture() {
  const W = 512, H = 640;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e4f9c'); g.addColorStop(1, '#0a3570');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e8c06a'; ctx.lineWidth = 8; ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 2; ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.fillStyle = '#ffe9a8';
  star(ctx, W / 2, 210, 70, 28); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '700 56px "Gowun Dodum", "Noto Sans KR", sans-serif';
  ctx.fillText('별빛 선물', W / 2, 380);
  ctx.font = '400 30px "Gowun Dodum", "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#e8c06a';
  ctx.fillText('크리스마스 동화', W / 2, 432);
  // 출판사 표기처럼 표지 하단에 작은 브랜드
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'italic 700 34px "Gowun Batang", Georgia, serif';
  ctx.fillText('Compassion', W / 2, 548);
  ctx.strokeStyle = 'rgba(232,192,106,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 90, 510); ctx.lineTo(W / 2 + 90, 510); ctx.stroke();
  return toTexture(c, { repeat: false });
}

export function tagTexture(nickname) {
  const W = 512, H = 320;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 6; ctx.setLineDash([16, 10]);
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.setLineDash([]);
  ctx.fillStyle = '#c8102e';
  heartPath(ctx, W - 80, 86, 40); ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.textAlign = 'left';
  ctx.font = '700 40px "Gowun Dodum", "Noto Sans KR", sans-serif';
  ctx.fillText('Merry Christmas', 46, 92);
  ctx.font = '400 32px "Gowun Dodum", "Noto Sans KR", sans-serif';
  ctx.fillText('To. 사랑하는 친구에게', 46, 170);
  ctx.fillStyle = '#0a5cb8';
  ctx.fillText(`From. ${nickname}`, 46, 236);
  return toTexture(c, { repeat: false });
}

export function chestBadgeTexture() {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#e0303f'; heartPath(ctx, S / 2, S / 2 + 14, 90); ctx.fill();
  return toTexture(c, { repeat: false });
}

// 털 가닥 알파맵 (셸 퍼): 촘촘한 점 하나하나가 털 한 가닥의 단면
let strandsTex;
export function furStrands() {
  if (strandsTex) return strandsTex;
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  const r = rng(77);
  for (let i = 0; i < 26000; i++) {
    const x = r() * S, y = r() * S, v = 90 + r() * 165;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + r() * 1.3, 0, 7); ctx.fill();
  }
  strandsTex = toTexture(c, { srgb: false });
  return strandsTex;
}

// 가죽 (결 + 가장자리 박음질)
export function leatherTexture(base = '#7a4526', stitch = true) {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const r = rng(5);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,220,180,0.06)';
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 2 + r() * 6, 1 + r() * 3, r() * 3, 0, 7); ctx.fill();
  }
  grain(ctx, S, 0.06, 21);
  if (stitch) {
    ctx.strokeStyle = 'rgba(235,205,160,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
    ctx.strokeRect(14, 14, S - 28, S - 28);
  }
  return toTexture(c, { repeat: false });
}

/**
 * 선물에 붙이는 "Compassion" 라벨/각인 텍스처.
 * @param {{w?:number,h?:number,bg?:string|null,fg?:string,font?:string,stitch?:string|null,pill?:boolean,sub?:string,shadow?:string|null}} o
 */
export function labelTexture(text, o = {}) {
  const W = o.w ?? 512, H = o.h ?? 128;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  if (o.bg) {
    ctx.fillStyle = o.bg;
    if (o.pill) {
      const r = H / 2;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(W - r, 0); ctx.arc(W - r, r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(r, H); ctx.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); ctx.fill();
    } else {
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (o.stitch) {
    ctx.strokeStyle = o.stitch; ctx.lineWidth = Math.max(2, H * 0.03); ctx.setLineDash([H * 0.09, H * 0.06]);
    const m = H * 0.12;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.setLineDash([]);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = o.font ?? `italic 700 ${Math.round(H * 0.5)}px "Gowun Batang", Georgia, serif`;
  ctx.font = font;
  const y = o.sub ? H * 0.4 : H * 0.53;
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(text, W / 2 + 2, y + 2); }
  ctx.fillStyle = o.fg ?? '#1f2a8a';
  ctx.fillText(text, W / 2, y);
  if (o.sub) {
    ctx.font = `400 ${Math.round(H * 0.26)}px "Gowun Dodum", "Noto Sans KR", sans-serif`;
    ctx.fillText(o.sub, W / 2, H * 0.78);
  }
  return toTexture(c, { repeat: false });
}

// 곰돌이 모자 둘레 (가운데에 "Compassion" 자수 느낌의 글씨)
export function capTextTexture() {
  const W = 1024, H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#1f2a8a'; ctx.fillRect(0, 0, W, H);
  grain(ctx, W, 0.08, 13);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'italic 600 58px "Gowun Batang", Georgia, serif';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('Compassion', W / 2 + 2, H / 2 + 4);
  ctx.fillStyle = '#e9ecf5';
  ctx.fillText('Compassion', W / 2, H / 2 + 2);
  return toTexture(c, { repeat: false });
}

// ---------- 파티클 스프라이트 ----------
export function glowSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTexture(c, { repeat: false });
}

export function heartSprite() {
  const S = 128;
  const [c, ctx] = canvas(S);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#ff6b7d'); g.addColorStop(1, '#d01a32');
  ctx.fillStyle = g; heartPath(ctx, S / 2, S / 2 + 10, 58); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(S * 0.36, S * 0.36, 9, 5, -0.7, 0, 7); ctx.fill();
  return toTexture(c, { repeat: false });
}

export function starSprite() {
  const S = 128;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.2, 'rgba(255,220,120,0.8)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255,255,240,0.95)';
  star(ctx, S / 2, S / 2, S * 0.48, S * 0.06, -Math.PI / 2, 4); ctx.fill();
  return toTexture(c, { repeat: false });
}

export function snowSprite() {
  const S = 64;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTexture(c, { repeat: false });
}

export function backgroundTexture() {
  const W = 1024, H = 1024;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1430'); g.addColorStop(0.55, '#1a1f45'); g.addColorStop(1, '#3a1d2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return toTexture(c, { repeat: false });
}
