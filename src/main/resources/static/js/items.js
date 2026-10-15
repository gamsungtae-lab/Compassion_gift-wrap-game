// 선물 카탈로그 — 서버 GiftType enum 과 id 를 맞춘다.
// 새 선물을 추가하려면: 여기에 항목 + build 함수, 서버 GiftType 에 id 추가.
import { THREE, RoundedBoxGeometry } from './three-deps.js';
import { createBear } from './bear.js';
import { soccerTexture, bookCoverTexture, knitTexture, woodTexture, labelTexture } from './textures.js';

function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh && !o.userData.decal) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

/** 표면에 살짝 띄워 붙이는 라벨(데칼) 재질 */
function decalMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra,
  });
}

function decal(mesh) {
  mesh.userData.decal = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildBear() {
  const b = createBear({ scale: 0.56 });
  const g = new THREE.Group();
  g.add(b.root);
  return g;
}

function buildSoccer() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.56, 96, 64),
    new THREE.MeshPhysicalMaterial({ map: soccerTexture(), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  ball.position.y = 0.56;
  ball.rotation.set(0.25, 0.3, 0.05);
  // 공 옆면 프린트 로고 (구면을 따라 휘어지는 패치, 가로:세로 ≈ 4:1)
  const span = 1.1, tall = 0.27;
  const logo = decal(new THREE.Mesh(
    new THREE.SphereGeometry(0.562, 48, 12, Math.PI / 2 - span / 2, span, Math.PI / 2 - tall / 2, tall),
    decalMaterial(labelTexture('Compassion', { bg: 'rgba(255,255,255,0.96)', pill: true, fg: '#1f2a8a' }), { roughness: 0.4 }),
  ));
  ball.add(logo);
  g.add(ball);
  return shadowed(g);
}

function buildBook() {
  const g = new THREE.Group();
  const cover = new THREE.MeshPhysicalMaterial({ color: '#0d4a94', roughness: 0.55, clearcoat: 0.3 });
  const front = new THREE.MeshPhysicalMaterial({ map: bookCoverTexture(), roughness: 0.5, clearcoat: 0.4 });
  const pages = new THREE.MeshStandardMaterial({ color: '#f5efdf', roughness: 0.9 });
  const W = 1.04, D = 1.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.18, D - 0.05), pages);
  body.position.set(0.02, 0.12, 0);
  g.add(body);
  const top = new THREE.Mesh(new RoundedBoxGeometry(W, 0.03, D, 2, 0.012), [cover, cover, front, cover, cover, cover]);
  top.position.y = 0.225;
  g.add(top);
  const bottom = new THREE.Mesh(new RoundedBoxGeometry(W, 0.03, D, 2, 0.012), cover);
  bottom.position.y = 0.015;
  g.add(bottom);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, D, 24, 1, false, Math.PI, Math.PI), cover);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(-W / 2 + 0.005, 0.12, 0);
  spine.scale.set(0.35, 1, 1);
  g.add(spine);
  // 책갈피 끈
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.35), new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.4 }));
  mark.position.set(0.2, 0.06, D / 2 + 0.12);
  mark.rotation.x = 0.5;
  g.add(mark);
  return shadowed(g);
}

function buildCrayons() {
  const g = new THREE.Group();
  const tray = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.14, 0.86, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6 }));
  tray.position.y = 0.07;
  g.add(tray);
  // 케이스 앞면 라벨
  const front = decal(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.11),
    decalMaterial(labelTexture('Compassion', { w: 1024, h: 102, bg: '#fbf6ea', fg: '#1f2a8a', sub: null,
      font: 'italic 700 62px "Gowun Batang", Georgia, serif' }))));
  front.position.set(0, 0.07, 0.432);
  g.add(front);
  const colors = ['#e63946', '#f4a261', '#ffd23f', '#3bb273', '#2a9df4', '#3a4cc9', '#8e44ad', '#5b3a29', '#ff8fab', '#111111'];
  const label = new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 0.8 });
  colors.forEach((c, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.3 });
    const cr = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 20), mat);
    cr.add(stick);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.36, 20), label);
    band.position.y = -0.06;
    cr.add(band);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 20), mat);
    tip.position.y = 0.37;
    cr.add(tip);
    cr.rotation.x = Math.PI / 2;
    cr.position.set(-0.58 + i * 0.128, 0.2, 0.02 + (i % 2) * 0.04);
    g.add(cr);
  });
  return shadowed(g);
}

function buildScarf() {
  const g = new THREE.Group();
  const tex = knitTexture();
  for (let i = 0; i < 3; i++) {
    const t = tex.clone();
    t.repeat.set(2, 1.2);
    t.needsUpdate = true;
    const layer = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.15, 0.9, 4, 0.07),
      new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffd6d6'), sheenRoughness: 0.6 }));
    layer.position.set((i % 2) * 0.04 - 0.02, 0.08 + i * 0.145, (i - 1) * 0.02);
    layer.rotation.y = (i - 1) * 0.04;
    g.add(layer);
  }
  // 맨 위 겹 모서리에 박음질한 네이비 태그
  const tag = decal(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.115),
    decalMaterial(labelTexture('Compassion', { bg: '#1f2a8a', fg: '#f4f1ea', stitch: 'rgba(255,255,255,0.7)' }), { roughness: 0.9 })));
  tag.rotation.set(-Math.PI / 2, 0, 0.06);
  tag.position.set(0.12, 0.452, 0.26);
  g.add(tag);
  // 술 장식
  const fringeMat = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.16, 6), fringeMat);
    f.rotation.z = Math.PI / 2;
    f.position.set(0.66, 0.38, -0.36 + i * 0.09);
    g.add(f);
  }
  return shadowed(g);
}

function buildSnowGlobe() {
  const g = new THREE.Group();
  const wood = woodTexture();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.28, 48),
    new THREE.MeshPhysicalMaterial({ map: wood, color: '#a0603a', roughness: 0.35, clearcoat: 0.8 }));
  base.position.y = 0.14;
  g.add(base);
  // 받침대 금속판 각인
  const gold = new THREE.MeshStandardMaterial({ color: '#e8c06a', metalness: 1, roughness: 0.25 });
  const engraved = new THREE.MeshStandardMaterial({
    map: labelTexture('Compassion', { bg: '#e8c06a', fg: '#5a3a12', shadow: 'rgba(255,240,200,0.6)' }),
    metalness: 0.85, roughness: 0.3,
  });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.02), [gold, gold, gold, gold, engraved, gold]);
  plaque.position.set(0, 0.14, 0.445);
  plaque.rotation.x = -0.28;
  g.add(plaque);
  const inside = new THREE.Group();
  inside.position.y = 0.28;
  const ground = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
  ground.scale.y = 0.2;
  inside.add(ground);
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1d6b3f', roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.05, 0.22, 24), treeMat);
    cone.position.y = 0.16 + i * 0.12;
    inside.add(cone);
  }
  const starTop = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffb300', emissiveIntensity: 2 }));
  starTop.position.y = 0.48;
  inside.add(starTop);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.6 }));
  house.position.set(0.2, 0.1, 0.12);
  inside.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  roof.position.set(0.2, 0.19, 0.12);
  roof.rotation.y = Math.PI / 4;
  inside.add(roof);
  // 유리 속 눈
  const snowGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 160; i++) {
    const r = Math.cbrt(Math.random()) * 0.42, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pts.push(r * Math.sin(ph) * Math.cos(th), 0.45 + r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.018 }));
  inside.add(snow);
  g.add(inside);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48),
    new THREE.MeshPhysicalMaterial({
      roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.4, ior: 1.45,
      clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 1, envMapIntensity: 1.4,
    }));
  glass.position.y = 0.72;
  shadowed(g);
  glass.castShadow = false;
  g.add(glass);
  g.userData.spin = (dt) => { snow.rotation.y += dt * 0.3; };
  return g;
}

export const GIFTS = [
  {
    id: 'BEAR', name: '컴패션 곰돌이', emoji: '🧸', desc: '꼭 안아주고 싶은 포근한 친구',
    box: [1.45, 1.22, 1.25], paper: 'blueDots', ribbon: '#c8102e', build: buildBear,
  },
  {
    id: 'SOCCER', showcaseScale: 0.55, name: '축구공', emoji: '⚽', desc: '운동장을 달리는 신나는 꿈',
    box: [1.32, 1.3, 1.32], paper: 'greenPlaid', ribbon: '#e8b64a', build: buildSoccer,
  },
  {
    id: 'BOOK', showcaseScale: 0.62, name: '그림 동화책', emoji: '📖', desc: '밤마다 펼쳐보는 별빛 이야기',
    box: [1.3, 0.5, 1.55], paper: 'redStars', ribbon: '#f3e3b8', build: buildBook,
  },
  {
    id: 'CRAYON', showcaseScale: 0.62, name: '크레파스 세트', emoji: '🖍️', desc: '세상을 알록달록 그릴 무지개',
    box: [1.6, 0.55, 1.1], paper: 'candyStripe', ribbon: '#1f7a4a', build: buildCrayons,
  },
  {
    id: 'SCARF', showcaseScale: 0.62, name: '털목도리', emoji: '🧣', desc: '추운 겨울을 녹이는 따뜻함',
    box: [1.5, 0.75, 1.15], paper: 'navySnow', ribbon: '#c8102e', build: buildScarf,
  },
  {
    id: 'SNOWGLOBE', showcaseScale: 0.62, name: '스노우볼', emoji: '🔮', desc: '흔들면 눈이 내리는 작은 세상',
    box: [1.25, 1.36, 1.25], paper: 'goldDamask', ribbon: '#e8b64a', build: buildSnowGlobe,
  },
];

export const giftById = (id) => GIFTS.find((g) => g.id === id) ?? GIFTS[0];
