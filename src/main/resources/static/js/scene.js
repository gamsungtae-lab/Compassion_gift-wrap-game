// 3D 무대: 렌더러/조명/소품/카메라 연출과 메인 루프
import {
  THREE, RoomEnvironment, EffectComposer, RenderPass, UnrealBloomPass, OutputPass,
} from './three-deps.js';
import { GiftWrap, stageIndex } from './wrapper.js';
import { Effects } from './particles.js';
import { woodTexture, feltTexture, backgroundTexture, setMaxAnisotropy } from './textures.js';

// RoomEnvironment 반사가 강해 흰 재질이 과노출되므로 반사 세기를 낮춘다 (r160 에는 scene.environmentIntensity 없음)
function tameEnv(root, k = 0.55) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m && 'envMapIntensity' in m && !m.userData.tamed) { m.envMapIntensity *= k; m.userData.tamed = true; }
    }
  });
}

const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;

export class Stage {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(devicePixelRatio, isMobile ? 1.75 : 2);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    scene.background = backgroundTexture();
    scene.fog = new THREE.Fog('#1b1d40', 12, 30);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camPos = new THREE.Vector3(0, 4, 10);
    this.camLook = new THREE.Vector3(0, 0.6, 0);
    this.camera.position.copy(this.camPos);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this._buildLights();
    this._buildSet();

    tameEnv(scene);

    this.effects = new Effects(scene);

    this.mode = 'intro';
    this.wrap = null;
    this.showcaseItem = null;
    this.targetP = 0; this.displayP = 0; this.pVel = 0;
    this.impulse = 0; this.energy = 0; this.shake = 0;
    this.stage = -1;
    this.onStageChange = null;
    this.completeSpin = 0;
    this.time = 0;
    this._perf = { frames: 0, acc: 0, checked: false };

    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
    this.resize();
    renderer.setAnimationLoop(() => this._frame());
  }

  _buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#bcd2ff', '#4a2418', 0.25));
    const key = new THREE.SpotLight('#ffe0b5', 38, 22, 0.55, 0.65, 1.6);
    key.position.set(3.2, 7.5, 5.2);
    key.target.position.set(0.3, 0.4, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    s.add(key, key.target);
    const rim = new THREE.DirectionalLight('#8fb2ff', 1.6);
    rim.position.set(-5, 4, -6);
    s.add(rim);
    const fill = new THREE.DirectionalLight('#ffd9c2', 0.35);
    fill.position.set(-2, 2, 6);
    s.add(fill);
    this.treeLight = new THREE.PointLight('#ffae5c', 18, 9, 1.5);
    this.treeLight.position.set(-3.4, 1.2, -2.2);
    s.add(this.treeLight);
  }

  _buildSet() {
    const s = this.scene;
    // 바닥
    const wood = woodTexture();
    wood.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, color: '#8a6a55' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.6;
    floor.receiveShadow = true;
    s.add(floor);

    // 원형 테이블 + 벨벳 식탁보
    const velvet = feltTexture('#5e0a18');
    velvet.repeat.set(4, 4);
    const cloth = new THREE.MeshPhysicalMaterial({
      map: velvet, color: '#ffffff', roughness: 0.85, envMapIntensity: 0.35, sheen: 0.8, sheenColor: new THREE.Color('#c23a52'), sheenRoughness: 0.5,
    });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.1, 96), cloth);
    top.position.y = -0.05;
    top.receiveShadow = true;
    s.add(top);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(3.32, 3.7, 1.6, 96, 1, true), cloth);
    drape.position.y = -0.88;
    drape.receiveShadow = true;
    s.add(drape);
    // 금색 테두리
    const trim = new THREE.Mesh(new THREE.TorusGeometry(3.31, 0.025, 12, 160),
      new THREE.MeshStandardMaterial({ color: '#e8c06a', metalness: 1, roughness: 0.25 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.0;
    s.add(trim);

    // 테이블 위 오너먼트 장식
    const ornaments = [
      ['#c8102e', -1.9, 0.9, 0.17], ['#e8c06a', -2.3, 0.2, 0.13], ['#0a5cb8', -1.5, 1.5, 0.11],
      ['#e8c06a', 2.6, -1.0, 0.14], ['#1f7a4a', -2.5, -0.8, 0.12],
    ];
    for (const [c, x, z, r] of ornaments) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32),
        new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.9, roughness: 0.12, clearcoat: 1 }));
      o.position.set(x, r, z);
      o.castShadow = true;
      s.add(o);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, r * 0.25, 16),
        new THREE.MeshStandardMaterial({ color: '#d9b25a', metalness: 1, roughness: 0.3 }));
      cap.position.set(x, r * 2, z);
      s.add(cap);
    }

    this._buildTree();
  }

  _buildTree() {
    const tree = new THREE.Group();
    tree.position.set(-4.2, -2.6, -3.6);
    const green = new THREE.MeshStandardMaterial({ color: '#0f4a2c', roughness: 0.8, flatShading: true });
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const r = 2.1 - i * 0.3, h = 1.6;
      const geo = new THREE.ConeGeometry(r, h, 14, 3);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const n = Math.sin(k * 12.9898) * 43758.5453;
        const j = (n - Math.floor(n) - 0.5) * 0.12;
        p.setXYZ(k, p.getX(k) * (1 + j), p.getY(k), p.getZ(k) * (1 + j));
      }
      geo.computeVertexNormals();
      const cone = new THREE.Mesh(geo, green);
      cone.position.y = 1.4 + i * 0.95;
      cone.castShadow = true;
      tree.add(cone);
    }
    // 전구 (블룸으로 빛남)
    const N = 140;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
    const colors = ['#ffcf6b', '#ff5a5a', '#7ac8ff', '#ffe9b0', '#ff9ad5'];
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const y = 0.9 + t * 5.6;
      const r = (1 - t) * 2.0 + 0.15;
      const a = t * Math.PI * 14;
      m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
      bulbs.setMatrixAt(i, m);
      bulbs.setColorAt(i, new THREE.Color(colors[i % colors.length]).multiplyScalar(2.4));
    }
    tree.add(bulbs);
    this.bulbs = bulbs;
    // 별
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 0.16 : 0.38, a = Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }),
      new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffb300', emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.3 }));
    star.position.set(0, 7.0, 0);
    tree.add(star);
    this.treeStar = star;
    // 트리 아래 선물들
    const gifts = [['#c8102e', 1.2, 0.6, 0.9], ['#0a5cb8', -0.6, 1.4, 0.7], ['#e8c06a', 1.6, -0.6, 0.6]];
    for (const [c, x, z, sz] of gifts) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.8, sz), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
      b.position.set(x, sz * 0.4, z + 1.2);
      b.rotation.y = x;
      tree.add(b);
    }
    this.scene.add(tree);
  }

  // ---------- 외부 API ----------
  showcase(gift) {
    this._clearWrap();
    if (this.showcaseItem) this.scene.remove(this.showcaseItem);
    const item = gift.build();
    const holder = new THREE.Group();
    holder.add(item);
    holder.userData.item = item;
    tameEnv(holder);
    this.scene.add(holder);
    this.showcaseItem = holder;
    holder.scale.setScalar(0.01);
    holder.userData.pop = 0;
    // 선택 화면 전용 표시 배율 (포장 단계 크기에는 영향 없음)
    holder.userData.base = gift.showcaseScale ?? 1;
  }

  startWrap(gift, nickname) {
    if (this.showcaseItem) { this.scene.remove(this.showcaseItem); this.showcaseItem = null; }
    this._clearWrap();
    this.wrap = new GiftWrap(gift, nickname);
    tameEnv(this.wrap.root);
    this.scene.add(this.wrap.root);
    this.targetP = 0; this.displayP = 0; this.pVel = 0;
    this.stage = 0;
    this.completeSpin = 0;
    this.completed = false;
  }

  _clearWrap() {
    if (this.wrap) {
      this.scene.remove(this.wrap.root);
      this.wrap.dispose();
      this.wrap = null;
    }
  }

  setMode(mode) { this.mode = mode; }

  setTarget(p) { this.targetP = Math.min(1, Math.max(0, p)); }

  tap(energy) {
    this.impulse = 1;
    this.shake = Math.min(1, this.shake + 0.25);
    if (this.wrap) this.effects.tap(this.wrap.topCenter(), energy);
  }

  complete() {
    if (this.completed) return;
    this.completed = true;
    this.completeSpin = 1;
    if (this.wrap) this.effects.burst(this.wrap.topCenter());
  }

  setEnergy(e) { this.energy = e; }

  /** 공유 이미지용 현재 화면 캡처 */
  capture() {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio?.(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- 루프 ----------
  _cameraGoal(t) {
    const aspect = this.camera.aspect;
    const portrait = aspect < 1;
    // 선물 선택 화면은 선물 하나만 보여주면 되므로 덜 물러난다
    const zoom = !portrait ? 1 : this.mode === 'select' ? Math.min(1.4, 0.66 / aspect) : Math.min(2.4, 1.12 / aspect);
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    switch (this.mode) {
      case 'intro': {
        const a = t * 0.07;
        pos.set(Math.sin(a) * 8.5, 3.6, Math.cos(a) * 8.5);
        look.set(0, 0.8, 0);
        break;
      }
      case 'select':
        // 아래쪽 선택 패널을 피해 선물이 화면 중앙보다 약간 위에 오도록 시선을 아래로 둔다
        pos.set(0, 1.9, 3.9);
        look.set(0, 0.2, 0);
        break;
      case 'result': {
        const a = Math.sin(t * 0.25) * 0.45;
        // 가로 화면에서는 오른쪽 결과 패널을 피해 선물을 왼쪽에 배치
        const cx = aspect > 1.2 ? 1.5 : 0;
        pos.set(cx + Math.sin(a) * 6.2, 2.8, Math.cos(a) * 6.2);
        look.set(cx, 0.65, 0);
        break;
      }
      default:
        pos.set(0, 3.0, 5.4);
        look.set(0, 0.6, 0);
    }
    if (zoom > 1) {
      const dir = pos.clone().sub(look);
      pos.copy(look).addScaledVector(dir, zoom);
      look.y -= 0.35 * (zoom - 1);
      look.x *= 0.6;
      pos.x *= 0.6;
    }
    if (portrait && this.mode === 'result') {
      // 결과 카드가 아래를 덮으므로 선물이 화면 위쪽 1/3 에 오도록
      look.y -= 1.6;
      pos.y -= 0.6;
    }
    return { pos, look };
  }

  _frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    const t = this.time;

    // 진행도 스프링 (임계 감쇠) — 탭마다 자연스럽게 따라감
    const k = 140, c = 2 * Math.sqrt(k);
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      const acc = k * (this.targetP - this.displayP) - c * this.pVel;
      this.pVel += acc * h;
      this.displayP += this.pVel * h;
    }
    if (this.wrap) {
      const p = Math.min(1, Math.max(0, this.displayP));
      this.wrap.setProgress(p);
      const st = stageIndex(p);
      if (st !== this.stage) {
        const prev = this.stage;
        this.stage = st;
        this.onStageChange?.(st, prev);
      }
      if (this.completeSpin > 0) {
        this.completeSpin = Math.max(0, this.completeSpin - dt * 0.8);
        const e = 1 - this.completeSpin;
        this.wrap.root.rotation.y = (1 - Math.pow(1 - e, 3)) * Math.PI * 2;
        this.wrap.root.position.y = Math.sin(e * Math.PI) * 0.5;
      }
      this.wrap.update(dt, t, this.impulse);
    }

    if (this.showcaseItem) {
      const h = this.showcaseItem;
      h.userData.pop = Math.min(1, h.userData.pop + dt * 2.5);
      const e = h.userData.pop;
      const s = 1 + Math.sin(e * Math.PI) * 0.12;
      h.scale.setScalar(Math.max(0.01, (e < 1 ? (1 - Math.pow(1 - e, 3)) * s : 1) * h.userData.base));
      h.rotation.y += dt * 0.6;
      h.position.y = 0.05 + Math.sin(t * 1.6) * 0.04;
      h.userData.item.userData.spin?.(dt);
    }

    this.impulse = THREE.MathUtils.damp(this.impulse, 0, 14, dt);
    this.shake = THREE.MathUtils.damp(this.shake, 0, 8, dt);

    this.effects.update(dt, t);
    this.treeStar.rotation.y = t * 0.5;
    this.treeLight.intensity = 16 + Math.sin(t * 2.3) * 3;

    const goal = this._cameraGoal(t);
    this.camPos.lerp(goal.pos, 1 - Math.exp(-dt * 2.2));
    this.camLook.lerp(goal.look, 1 - Math.exp(-dt * 2.6));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * 0.03 * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * 0.03 * this.shake;
    }
    this.camera.lookAt(this.camLook);

    this.composer.render();
    this._adaptQuality(dt);
  }

  /** 첫 3초 평균 프레임이 느리면 해상도/효과를 낮춰 모바일에서도 부드럽게 */
  _adaptQuality(dt) {
    const p = this._perf;
    if (p.checked) return;
    p.frames++; p.acc += dt;
    if (p.acc > 3) {
      p.checked = true;
      const avg = p.acc / p.frames;
      if (avg > 1 / 40) {
        this.renderer.setPixelRatio(Math.min(1.25, this.pixelRatio));
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.bloom.strength = 0.35;
        this.resize();
      }
    }
  }
}
