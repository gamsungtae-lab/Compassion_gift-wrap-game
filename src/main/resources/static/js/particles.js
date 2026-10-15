// 파티클: 탭 하트/반짝이, 완성 컨페티, 배경 눈송이와 보케 조명
import { THREE } from './three-deps.js';
import { heartSprite, starSprite, snowSprite, glowSprite } from './textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.sprites = [];
    const heart = new THREE.SpriteMaterial({ map: heartSprite(), transparent: true, depthWrite: false });
    const star = new THREE.SpriteMaterial({ map: starSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite((i % 3 === 0 ? heart : star).clone());
      s.visible = false;
      s.userData = { life: 0, max: 1, v: new THREE.Vector3(), size: 0.2, kind: i % 3 === 0 ? 'heart' : 'star' };
      scene.add(s);
      this.sprites.push(s);
    }
    this._buildConfetti();
    this._buildSnow();
    this._buildBokeh();
  }

  _spawn(kind, pos, speed, size, life) {
    const s = this.sprites.find((x) => !x.visible && x.userData.kind === kind);
    if (!s) return;
    s.visible = true;
    s.position.copy(pos);
    const d = s.userData;
    d.life = 0; d.max = life; d.size = size;
    d.v.set((Math.random() - 0.5) * speed, speed * (0.8 + Math.random() * 0.8), (Math.random() - 0.5) * speed * 0.6);
    s.material.rotation = (Math.random() - 0.5) * 0.6;
  }

  /** 탭 한 번마다: 하트 1~2개 + 반짝이 */
  tap(pos, energy = 0) {
    const n = 2 + Math.round(energy * 2);
    for (let i = 0; i < n; i++) this._spawn('star', pos, 2.2 + energy * 2, 0.16 + Math.random() * 0.12, 0.6 + Math.random() * 0.3);
    if (Math.random() < 0.55 + energy * 0.4) this._spawn('heart', pos, 1.4, 0.18 + Math.random() * 0.1, 1.1);
  }

  burst(pos) {
    for (let i = 0; i < 20; i++) this._spawn('star', pos, 4.5, 0.25 + Math.random() * 0.2, 1 + Math.random() * 0.5);
    for (let i = 0; i < 10; i++) this._spawn('heart', pos, 3, 0.25 + Math.random() * 0.12, 1.6);
    this.confetti(pos);
  }

  _buildConfetti() {
    const N = 220;
    const geo = new THREE.PlaneGeometry(0.07, 0.12);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3 });
    this.conf = new THREE.InstancedMesh(geo, mat, N);
    this.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const palette = ['#e0303f', '#ffd23f', '#0a5cb8', '#3bb273', '#ffffff', '#ff8fab', '#e8b64a'].map((c) => new THREE.Color(c));
    this.confData = [];
    for (let i = 0; i < N; i++) {
      this.conf.setColorAt(i, palette[i % palette.length]);
      this.confData.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
    }
    this.conf.frustumCulled = false;
    this.scene.add(this.conf);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  confetti(pos) {
    for (const c of this.confData) {
      c.p.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      c.v.set(Math.cos(a) * sp, 4 + Math.random() * 4, Math.sin(a) * sp);
      c.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      c.life = 3.5;
    }
  }

  _buildSnow() {
    const N = 700;
    const pos = new Float32Array(N * 3);
    this.snowSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = -3 + Math.random() * 12;
      pos[i * 3 + 2] = -10 + Math.random() * 14;
      this.snowSpeed[i] = 0.25 + Math.random() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({
      map: snowSprite(), size: 0.09, transparent: true, depthWrite: false, opacity: 0.85, color: '#ffffff',
    }));
    this.scene.add(this.snow);
  }

  _buildBokeh() {
    this.bokeh = new THREE.Group();
    const colors = ['#ffcf7a', '#ff9a5c', '#ffe7b0', '#ff6b6b', '#9ad0ff', '#ffd700'];
    for (let i = 0; i < 46; i++) {
      const c = colors[i % colors.length];
      const m = new THREE.SpriteMaterial({ map: glowSprite(), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false });
      const s = new THREE.Sprite(m);
      const sz = 0.4 + Math.random() * 1.3;
      s.scale.setScalar(sz);
      s.position.set((Math.random() - 0.5) * 26, -1 + Math.random() * 9, -11 - Math.random() * 6);
      s.userData = { phase: Math.random() * 10, base: 0.25 + Math.random() * 0.45 };
      this.bokeh.add(s);
    }
    this.scene.add(this.bokeh);
  }

  update(dt, time) {
    for (const s of this.sprites) {
      if (!s.visible) continue;
      const d = s.userData;
      d.life += dt;
      if (d.life >= d.max) { s.visible = false; continue; }
      const k = d.life / d.max;
      d.v.y -= (d.kind === 'heart' ? 0.6 : 3.5) * dt;
      s.position.addScaledVector(d.v, dt);
      const sz = d.size * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.6);
      s.scale.set(sz, sz, sz);
      s.material.opacity = 1 - k * k;
    }

    let any = false;
    this.confData.forEach((c, i) => {
      if (c.life > 0) {
        any = true;
        c.life -= dt;
        c.v.y -= 6 * dt;
        c.v.multiplyScalar(1 - 1.6 * dt);
        c.p.addScaledVector(c.v, dt);
        if (c.p.y < 0.02 && Math.abs(c.p.x) < 3 && Math.abs(c.p.z) < 3) { c.p.y = 0.02; c.v.set(0, 0, 0); c.w.multiplyScalar(0.9); }
        c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
        if (c.life <= 0) c.p.y = -99;
      }
      this._q.setFromEuler(c.r);
      this._m.compose(c.p, this._q, this._one);
      this.conf.setMatrixAt(i, this._m);
    });
    if (any || this._confWasActive) this.conf.instanceMatrix.needsUpdate = true;
    this._confWasActive = any;

    const p = this.snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - this.snowSpeed[i] * dt;
      if (y < -3) y = 9;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(time * 0.5 + i) * 0.002);
    }
    p.needsUpdate = true;

    for (const s of this.bokeh.children) {
      s.material.opacity = s.userData.base + Math.sin(time * 0.8 + s.userData.phase) * 0.15;
    }
  }
}
