// 선물 포장 연출. setProgress(p: 0~1) 하나로 모든 단계를 결정적으로 배치한다.
// 실제 포장 순서: 선물 넣기 → 뚜껑 → 포장지 깔기 → 양옆 접기 → 앞/뒤 감싸기 → 테이프 → 리본 → 나비매듭 → 카드
import { THREE, RoundedBoxGeometry } from './three-deps.js';
import { paperTexture, paperBump, tagTexture } from './textures.js';

export const STAGES = [
  { at: 0.00, label: '선물을 상자에 담는 중' },
  { at: 0.10, label: '뚜껑을 닫는 중' },
  { at: 0.18, label: '포장지를 펼치는 중' },
  { at: 0.28, label: '양옆을 접는 중' },
  { at: 0.38, label: '포장지로 감싸는 중' },
  { at: 0.52, label: '테이프 붙이는 중' },
  { at: 0.58, label: '리본 두르는 중' },
  { at: 0.74, label: '나비 매듭 짓는 중' },
  { at: 0.88, label: '사랑의 카드 다는 중' },
  { at: 1.00, label: '포장 완성!' },
];

export function stageIndex(p) {
  if (p >= 0.995) return STAGES.length - 1;
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (p >= STAGES[k].at) i = k;
  return i;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutElastic = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1);
const easeOutBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

const PT = 0.006;      // 종이 두께
const TILE = 0.75;     // 포장지 무늬 반복 크기(월드 단위)

export class GiftWrap {
  constructor(gift, nickname) {
    this.gift = gift;
    const [W, H, D] = gift.box;
    this.W = W; this.H = H; this.D = D;
    this.root = new THREE.Group();
    this.spinner = new THREE.Group();   // 완성 후 회전/탭 반동용
    this.root.add(this.spinner);

    this._buildBox();
    this._buildPaper();
    this._buildTape();
    this._buildRibbon();
    this._buildBow();
    this._buildTag(nickname);

    this.item = gift.build();
    this.boxGroup.add(this.item);

    this.root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.progress = 0;
    this.setProgress(0);
  }

  // ---------- 구성 ----------
  _buildBox() {
    const { W, H, D } = this;
    const t = 0.035;
    const kraft = new THREE.MeshStandardMaterial({ color: '#b07f4c', roughness: 0.85 });
    const kraftIn = new THREE.MeshStandardMaterial({ color: '#b48552', roughness: 0.95 });
    this.boxGroup = new THREE.Group();
    this.boxGroup.position.y = PT + 0.002;
    this.spinner.add(this.boxGroup);
    const add = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [kraft, kraft, kraftIn, kraft, kraft, kraft]);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      this.boxGroup.add(m);
    };
    add(W, t, D, 0, t / 2, 0);
    add(W, H, t, 0, H / 2, D / 2 - t / 2);
    add(W, H, t, 0, H / 2, -D / 2 + t / 2);
    add(t, H, D - 2 * t, W / 2 - t / 2, H / 2, 0);
    add(t, H, D - 2 * t, -W / 2 + t / 2, H / 2, 0);

    this.lid = new THREE.Mesh(new RoundedBoxGeometry(W + 0.004, 0.12, D + 0.004, 2, 0.015), kraft);
    this.lid.castShadow = true;
    this.boxGroup.add(this.lid);
  }

  _paperPanel(sizeAlong, sizeAcross, axis, dir, outerMat, innerMat) {
    // axis 'x' 또는 'z' 방향으로 [0, sizeAlong*dir] 구간에 펼쳐진 얇은 판
    const geo = axis === 'x'
      ? new THREE.BoxGeometry(sizeAlong, PT, sizeAcross)
      : new THREE.BoxGeometry(sizeAcross, PT, sizeAlong);
    const sx = axis === 'x' ? sizeAlong : sizeAcross;
    const sz = axis === 'x' ? sizeAcross : sizeAlong;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / TILE, uv.getY(i) * sz / TILE);
    if (axis === 'x') geo.translate((sizeAlong / 2) * dir, 0, 0);
    else geo.translate(0, 0, (sizeAlong / 2) * dir);
    const m = new THREE.Mesh(geo, [innerMat, innerMat, innerMat, outerMat, innerMat, innerMat]);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  _buildPaper() {
    const { W, H, D } = this;
    const outer = new THREE.MeshPhysicalMaterial({
      map: paperTexture(this.gift.paper), roughness: 0.38, metalness: 0.05,
      clearcoat: 0.25, clearcoatRoughness: 0.35, bumpMap: paperBump(), bumpScale: 0.25,
    });
    const inner = new THREE.MeshStandardMaterial({ color: '#e4ddcf', roughness: 0.95 });
    this.paperMats = [outer, inner];
    const e1 = 0.012, e2 = 0.022, e3 = 0.032;
    this.topY = H + e3 + PT;

    this.paper = new THREE.Group();
    this.spinner.add(this.paper);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * e3 + 0.02, PT, D + 2 * e3 + 0.02), [inner, inner, inner, outer, inner, inner]);
    bottom.position.y = PT / 2;
    bottom.receiveShadow = true;
    this.paper.add(bottom);

    const mk = (axis, dir, offset, side, flapLen, width) => {
      const hinge = new THREE.Group();
      if (axis === 'x') hinge.position.set(dir * (W / 2 + offset), PT, 0);
      else hinge.position.set(0, PT, dir * (D / 2 + offset));
      hinge.add(this._paperPanel(side, width, axis, dir, outer, inner));
      const flap = new THREE.Group();
      if (axis === 'x') flap.position.x = dir * side; else flap.position.z = dir * side;
      flap.add(this._paperPanel(flapLen, width, axis, dir, outer, inner));
      hinge.add(flap);
      this.paper.add(hinge);
      return { hinge, flap, axis, dir };
    };
    this.panels = {
      left: mk('x', -1, e1, H + e1, W * 0.44, D + 2 * e1),
      right: mk('x', 1, e1, H + e1, W * 0.44, D + 2 * e1),
      front: mk('z', 1, e2, H + e2, D / 2 + 0.05, W + 2 * e2),
      back: mk('z', -1, e3, H + e3, D / 2 + 0.05, W + 2 * e3),
    };
  }

  _buildTape() {
    const { W, H, D } = this;
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, roughness: 0.12, clearcoat: 1 });
    const mk = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = false;
      this.spinner.add(m);
      return m;
    };
    this.tapes = [
      mk(W * 0.42, 0.004, 0.13, -W * 0.18, this.topY + 0.008, 0.02),
      mk(0.004, H * 0.32, 0.13, -(W / 2 + 0.019), H * 0.55, -D * 0.27),
      mk(0.004, H * 0.32, 0.13, W / 2 + 0.019, H * 0.55, D * 0.27),
    ];
  }

  _buildRibbon() {
    const { W, H, D } = this;
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.gift.ribbon, roughness: 0.28, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15,
      sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.3,
    });
    this.ribbonMat = mat;
    const rw = 0.15, rt = 0.012, ro = 0.042;
    const top = this.topY + rt / 2 + 0.004;
    const mk = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.spinner.add(m);
      return m;
    };
    const sideH = top;
    const sideGeo = (w, d) => { const g = new THREE.BoxGeometry(w, sideH, d); g.translate(0, -sideH / 2, 0); return g; };
    this.ribbons = {
      aTop: mk(new THREE.BoxGeometry(W + 2 * ro, rt, rw), 0, top, 0),
      aL: mk(sideGeo(rt, rw), -(W / 2 + ro), top, 0),
      aR: mk(sideGeo(rt, rw), W / 2 + ro, top, 0),
      bTop: mk(new THREE.BoxGeometry(rw, rt, D + 2 * ro + 0.01), 0, top + rt, 0),
      bF: mk(sideGeo(rw, rt), 0, top + rt, D / 2 + ro + 0.005),
      bB: mk(sideGeo(rw, rt), 0, top + rt, -(D / 2 + ro + 0.005)),
    };
    this.ribbonTop = top + rt * 1.5;
  }

  _buildBow() {
    const mat = this.ribbonMat;
    this.bow = new THREE.Group();
    this.bow.position.y = this.ribbonTop;
    const loopGeo = new THREE.TorusGeometry(0.2, 0.055, 16, 48);
    const loops = [
      [0.2, 0.13, 0, 0, 0.45, 1],
      [-0.2, 0.13, 0, 0, -0.45, 1],
      [0, 0.1, 0.15, Math.PI / 2, 0.4, 0.75],
      [0, 0.1, -0.15, Math.PI / 2, -0.4, 0.75],
    ];
    for (const [x, y, z, ry, rz, s] of loops) {
      const holder = new THREE.Group();
      holder.position.set(x, y, z);
      holder.rotation.y = ry;
      const loop = new THREE.Mesh(loopGeo, mat);
      loop.rotation.z = rz;
      loop.scale.set(s, s * 0.62, 0.42);
      loop.castShadow = true;
      holder.add(loop);
      this.bow.add(holder);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), mat);
    knot.scale.set(1, 0.8, 1);
    knot.position.y = 0.06;
    knot.castShadow = true;
    this.bow.add(knot);
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.42), mat);
      tail.position.set(0.1 * s, 0.01, 0.2);
      tail.rotation.set(0.12, -0.45 * s, 0);
      tail.castShadow = true;
      this.bow.add(tail);
    }
    this.spinner.add(this.bow);
  }

  _buildTag(nickname) {
    const tex = tagTexture(nickname);
    const card = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.7, clearcoat: 0.2 });
    const plain = new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 0.8 });
    this.tag = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.008), [plain, plain, plain, plain, card, plain]);
    mesh.position.y = -0.16;
    mesh.castShadow = true;
    this.tag.add(mesh);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#e8c06a' }));
    string.position.set(0, 0.1, 0);
    this.tag.add(string);
    this.tag.position.set(this.W * 0.22, this.ribbonTop + 0.02, this.D / 2 + 0.07);
    this.spinner.add(this.tag);
  }

  // ---------- 진행도 → 배치 ----------
  setProgress(p) {
    this.progress = p;
    const { H } = this;

    // 0) 선물이 상자로 떨어짐
    const s0 = seg(p, 0, 0.1);
    this.item.visible = p < 0.2;
    this.item.position.y = 0.04 + (1 - easeOutBounce(s0)) * (H + 2.4);
    this.item.rotation.y = (1 - easeOut(s0)) * 2.4;

    // 1) 뚜껑
    const s1 = seg(p, 0.1, 0.18);
    this.lid.visible = p > 0.095;
    const lidT = easeOutBack(s1);
    this.lid.position.y = H - 0.056 + (1 - lidT) * 1.8;
    this.lid.rotation.x = (1 - easeOut(s1)) * 0.7;
    this.lid.rotation.z = (1 - easeOut(s1)) * -0.25;

    // 2) 상자가 들렸다 내려오며 포장지가 미끄러져 들어옴
    const s2 = seg(p, 0.18, 0.28);
    this.paper.visible = p > 0.175;
    this.boxGroup.position.y = PT + 0.002 + Math.sin(Math.PI * easeInOut(s2)) * 0.85;
    this.boxGroup.rotation.z = Math.sin(Math.PI * s2) * 0.06;
    const slide = easeOut(seg(s2, 0, 0.75));
    this.paper.position.z = (1 - slide) * 4.5;
    this.paper.rotation.y = (1 - slide) * 0.35;
    this.paper.scale.setScalar(0.85 + 0.15 * slide);

    // 3) 양옆 접기, 4) 앞/뒤 감싸기
    const fold = (panel, a, b, c, d) => {
      const up = easeInOut(seg(p, a, b));
      const over = easeInOut(seg(p, c, d));
      const ang = Math.PI / 2;
      if (panel.axis === 'x') {
        panel.hinge.rotation.z = panel.dir * ang * up;
        panel.flap.rotation.z = panel.dir * ang * over;
      } else {
        panel.hinge.rotation.x = -panel.dir * ang * up;
        panel.flap.rotation.x = -panel.dir * ang * over;
      }
    };
    fold(this.panels.left, 0.28, 0.34, 0.32, 0.37);
    fold(this.panels.right, 0.29, 0.35, 0.33, 0.38);
    fold(this.panels.front, 0.38, 0.43, 0.42, 0.46);
    fold(this.panels.back, 0.45, 0.49, 0.48, 0.52);

    // 5) 테이프
    this.tapes.forEach((t, i) => {
      const k = easeOutBack(seg(p, 0.52 + i * 0.018, 0.545 + i * 0.018));
      t.visible = k > 0.001;
      t.scale.setScalar(Math.max(0.001, k));
    });

    // 6) 리본
    const r = this.ribbons;
    const grow = (m, a, b, axis) => {
      const k = easeOut(seg(p, a, b));
      m.visible = k > 0.001;
      m.scale[axis] = Math.max(0.001, k);
    };
    grow(r.aTop, 0.58, 0.63, 'x');
    grow(r.aL, 0.62, 0.66, 'y');
    grow(r.aR, 0.62, 0.66, 'y');
    grow(r.bTop, 0.66, 0.7, 'z');
    grow(r.bF, 0.69, 0.74, 'y');
    grow(r.bB, 0.69, 0.74, 'y');

    // 7) 나비매듭
    const s7 = seg(p, 0.74, 0.88);
    this.bow.visible = s7 > 0;
    this.bow.scale.setScalar(Math.max(0.001, easeOutElastic(s7)));
    this.bow.rotation.y = (1 - easeOut(s7)) * -Math.PI;

    // 8) 카드
    const s8 = seg(p, 0.88, 1);
    this.tag.visible = s8 > 0;
    this.tag.scale.setScalar(Math.max(0.001, easeOutBack(s8)));
    this.tag.rotation.set(-0.35 + (1 - easeOut(s8)) * -1.2, -0.25 + (1 - easeOut(s8)) * 2.2, 0);
  }

  /** 탭 반동 및 완성 후 흔들림 등 프레임 단위 효과 */
  update(dt, time, impulse) {
    const k = impulse;
    this.spinner.scale.set(1 + k * 0.05, 1 - k * 0.07, 1 + k * 0.05);
    this.spinner.position.y = 0;
    if (this.item.userData.spin) this.item.userData.spin(dt);
    if (this.bow.visible) {
      this.bow.children.forEach((c, i) => { if (i < 4) c.rotation.x = Math.sin(time * 3 + i) * 0.04 + k * 0.15; });
    }
    if (this.tag.visible && this.progress >= 1) {
      this.tag.rotation.z = Math.sin(time * 2.2) * 0.08;
    }
  }

  /** 선물 위쪽 중심 (파티클 발생 위치) */
  topCenter(target = new THREE.Vector3()) {
    return this.root.localToWorld(target.set(0, this.H + 0.3, 0));
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
      }
    });
  }
}
