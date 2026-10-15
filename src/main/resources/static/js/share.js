// 결과 공유: 링크(도전장) 공유 + 인스타 등에 올릴 1080×1350 결과 카드 이미지 생성
import { GRADES } from './scoring.js';

const FONT = '"Gowun Dodum", "Noto Sans KR", sans-serif';
const SERIF = '"Gowun Batang", "Noto Serif KR", serif';

export function challengeUrl(gameId) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('challenge', gameId);
  return u.toString();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function buildShareImage({ snapshot, nickname, score, grade, allRank, giftName, tapCount, peakTps }) {
  await document.fonts?.ready;
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1533'); bg.addColorStop(0.6, '#1d1f4a'); bg.addColorStop(1, '#4a1426');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  if (snapshot) {
    const img = await loadImage(snapshot);
    const boxW = W - 120, boxH = 720;
    const s = Math.max(boxW / img.width, boxH / img.height);
    const sw = boxW / s, sh = boxH / s;
    ctx.save();
    roundRect(ctx, 60, 200, boxW, boxH, 40); ctx.clip();
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 60, 200, boxW, boxH);
    const fade = ctx.createLinearGradient(0, 700, 0, 920);
    fade.addColorStop(0, 'rgba(20,20,50,0)'); fade.addColorStop(1, 'rgba(20,20,50,0.85)');
    ctx.fillStyle = fade; ctx.fillRect(60, 700, boxW, 220);
    ctx.restore();
    ctx.strokeStyle = 'rgba(232,192,106,0.7)'; ctx.lineWidth = 4;
    roundRect(ctx, 60, 200, boxW, boxH, 40); ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c06a';
  ctx.font = `italic 600 40px ${SERIF}`;
  ctx.fillText('Merry Christmas', W / 2, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 54px ${SERIF}`;
  ctx.fillText('컴패션 선물 포장 챌린지', W / 2, 158);

  const g = GRADES[grade] ?? GRADES.C;
  ctx.fillStyle = g.color;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(`${grade} · ${g.title}`, W / 2, 870);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 120px ${FONT}`;
  ctx.fillText(score.toLocaleString('ko-KR'), W / 2, 1040);
  ctx.font = `400 40px ${FONT}`;
  ctx.fillStyle = '#cfd6ff';
  ctx.fillText(`${nickname} 님 · ${giftName}`, W / 2, 1105);
  const parts = [];
  if (allRank) parts.push(`전체 ${allRank.rank.toLocaleString()}위 / ${allRank.total.toLocaleString()}명`);
  if (tapCount != null) parts.push(`${tapCount}탭 · 최고 초당 ${peakTps}회`);
  ctx.font = `400 36px ${FONT}`;
  ctx.fillText(parts.join('  ·  '), W / 2, 1165);

  ctx.fillStyle = 'rgba(232,192,106,0.95)';
  roundRect(ctx, W / 2 - 300, 1210, 600, 84, 42); ctx.fill();
  ctx.fillStyle = '#3a1020';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('나도 선물 포장하러 가기 🎁', W / 2, 1265);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export async function shareResult({ blob, text, url }) {
  const file = blob ? new File([blob], 'compassion-gift-wrap.png', { type: 'image/png' }) : null;
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '컴패션 선물 포장 챌린지', text: `${text}\n${url}` });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: '컴패션 선물 포장 챌린지', text, url });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
