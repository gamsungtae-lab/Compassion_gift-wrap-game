// 컴패션 곰돌이 — 실제 인형(흰 털, 네이비 우체부 모자/스카프, 가죽 메신저백)을 본뜬 절차적 모델
// 털은 셸 퍼(shell fur) 기법: 본체 위에 조금씩 부풀린 반투명 껍질을 여러 겹 쌓아 봉제 인형의 북실한 결을 표현
import { THREE, RoundedBoxGeometry } from './three-deps.js';
import { furStrands, leatherTexture, capTextTexture } from './textures.js';

const SHELLS = 7;
const FUR_LEN = 0.034; // 털 길이 (곰 기준 크기 1일 때, 월드 단위)

function makeShellMaterials(color, scale) {
  const strands = furStrands();
  const mats = [];
  const base = new THREE.Color(color);
  for (let i = 1; i <= SHELLS; i++) {
    const k = i / SHELLS;
    const m = new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.86 + 0.16 * k), // 안쪽은 그림자, 끝은 밝게
      roughness: 1,
      alphaMap: strands,
      alphaTest: 0.3 + 0.55 * k, // 바깥 껍질일수록 가닥이 가늘어짐
    });
    const offset = FUR_LEN * k * scale;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uShell = { value: offset };
      shader.vertexShader = `uniform float uShell;\n${shader.vertexShader}`.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
         mvPosition.xyz += normalize( normalMatrix * objectNormal ) * uShell;
         gl_Position = projectionMatrix * mvPosition;`,
      );
    };
    m.customProgramCacheKey = () => `shell-${offset.toFixed(4)}`;
    mats.push(m);
  }
  return mats;
}

export function createBear({ scale = 1 } = {}) {
  const strands = furStrands();
  strands.repeat.set(6, 6);
  const furColor = '#e9e5dc';
  const fur = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 1 });
  const shellMats = makeShellMaterials(furColor, scale);
  const muzzleShells = makeShellMaterials('#f1ede4', scale);

  const navy = new THREE.MeshPhysicalMaterial({ color: '#232f96', roughness: 0.9, sheen: 0.9, sheenColor: new THREE.Color('#7480ff'), sheenRoughness: 0.5 });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: '#1c2468', roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color('#5561d6'), sheenRoughness: 0.4 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#0b0909', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 });
  const leatherTex = leatherTexture('#7a4526', false);
  const leather = new THREE.MeshPhysicalMaterial({ map: leatherTex, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 });
  const flapMat = new THREE.MeshPhysicalMaterial({ map: leatherTexture('#6c3b1f', true), roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const body = new THREE.Group();
  root.add(body);

  /** 털 덮인 부위: 본체 + 셸 */
  function furry(geo, shells = shellMats) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(geo, fur);
    core.castShadow = true;
    core.receiveShadow = true;
    g.add(core);
    for (const m of shells) {
      const s = new THREE.Mesh(geo, m);
      s.receiveShadow = true;
      g.add(s);
    }
    return g;
  }
  const sphere = (r, seg = 40) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
  const furBlob = (r, sx = 1, sy = 1, sz = 1, shells) => {
    const g = furry(sphere(r), shells);
    g.scale.set(sx, sy, sz);
    return g;
  };

  // 다리 (짧고 통통하게 서 있는 자세)
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.17 * s, 0.42, 0);
    const l = furry(new THREE.CapsuleGeometry(0.15, 0.2, 10, 28));
    l.position.y = -0.18;
    leg.add(l);
    const foot = furBlob(0.16, 1, 0.6, 1.15);
    foot.position.set(0, -0.35, 0.05);
    leg.add(foot);
    body.add(leg);
    legs.push(leg);
  }

  // 몸통 (서양배 모양)
  const TORSO = { y: 0.82, a: 0.4, b: 0.5, c: 0.34 };
  const torso = furBlob(1, TORSO.a, TORSO.b, TORSO.c);
  torso.position.y = TORSO.y;
  body.add(torso);
  const belly = furBlob(1, 0.33, 0.36, 0.3);
  belly.position.set(0, 0.68, 0.06);
  body.add(belly);

  // 옆구리 라벨 택 (네이비)
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.06), navy);
  tag.position.set(-0.4, 0.74, 0.08);
  tag.rotation.z = 0.15;
  body.add(tag);

  // 팔 (어깨에서 아래로 늘어진 긴 봉제 팔)
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.3 * s, 1.12, 0.02);
    const arm = furry(new THREE.CapsuleGeometry(0.115, 0.44, 10, 28));
    arm.position.y = -0.29;
    shoulder.add(arm);
    shoulder.userData.side = s;
    shoulder.rotation.z = 0.5 * s;
    body.add(shoulder);
    arms.push(shoulder);
  }

  // 네이비 스카프 + 앞 매듭 + 늘어진 꼬리 두 개
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.05, 16, 56), navy);
  scarf.rotation.x = Math.PI / 2 - 0.15;
  scarf.scale.set(1.08, 1, 0.9);
  scarf.position.set(0, 1.23, 0.03);
  scarf.castShadow = true;
  body.add(scarf);
  const knot = new THREE.Mesh(sphere(0.05, 20), navy);
  knot.scale.set(1.1, 0.85, 0.8);
  knot.position.set(-0.05, 1.16, 0.27);
  body.add(knot);
  const tieGeo = new THREE.ConeGeometry(0.065, 0.3, 4);
  tieGeo.translate(0, -0.15, 0);
  for (const [x, rz, ry] of [[-0.07, -0.1, 0.7], [-0.03, 0.2, 0.4]]) {
    const tie = new THREE.Mesh(tieGeo, navy);
    tie.position.set(x, 1.15, 0.28);
    tie.rotation.set(-0.3, ry, rz);
    tie.scale.set(1, 1, 0.22);
    tie.castShadow = true;
    body.add(tie);
  }

  // 가죽 끈: 오른쪽 어깨 → 왼쪽 허리, 몸통 곡면을 따라가는 리본 지오메트리
  {
    const N = 28, half = 0.034, lift = FUR_LEN * 0.9 + 0.006;
    const pos = [], uv = [], idx = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3(), prev = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
    const surface = (t, out, normal) => {
      const x = THREE.MathUtils.lerp(-0.25, 0.33, t);
      const y = THREE.MathUtils.lerp(1.2, 0.6, t);
      const dy = y - TORSO.y;
      const q = 1 - (x / TORSO.a) ** 2 - (dy / TORSO.b) ** 2;
      const z = TORSO.c * Math.sqrt(Math.max(0.04, q));
      normal.set(x / TORSO.a ** 2, dy / TORSO.b ** 2, z / TORSO.c ** 2).normalize();
      out.set(x, y, z).addScaledVector(normal, lift);
    };
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      surface(t, p, n);
      surface(Math.min(1, t + 0.01), prev, side);
      tan.subVectors(prev, p).normalize();
      if (i === N) { surface(t - 0.01, prev, side); tan.subVectors(p, prev).normalize(); }
      side.crossVectors(tan, n).normalize().multiplyScalar(half);
      pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
      uv.push(0, t * 4, 1, t * 4);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const strap = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: leatherTex, roughness: 0.55, clearcoat: 0.3, side: THREE.DoubleSide }));
    strap.castShadow = true;
    body.add(strap);
  }

  // 가방: 본체 + 박음질 덮개 + 고리
  const bag = new THREE.Group();
  bag.position.set(0.4, 0.56, 0.17);
  bag.rotation.set(0.06, 0.55, -0.1);
  const pouch = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.3, 0.11, 4, 0.045), leather);
  pouch.castShadow = true;
  bag.add(pouch);
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.22, 0.02, 4, 0.009), flapMat);
  flap.position.set(0, 0.05, 0.065);
  flap.rotation.x = -0.06;
  flap.castShadow = true;
  bag.add(flap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 20), new THREE.MeshStandardMaterial({ color: '#c9a45a', metalness: 1, roughness: 0.3 }));
  ring.position.set(-0.16, 0.15, 0);
  ring.rotation.y = Math.PI / 2;
  bag.add(ring);
  body.add(bag);

  // 머리
  const head = new THREE.Group();
  head.position.y = 1.58;
  body.add(head);
  head.add(furBlob(0.36, 1.07, 0.95, 0.95));
  const muzzle = furBlob(0.15, 1.15, 0.85, 1.05, muzzleShells);
  muzzle.position.set(0, -0.1, 0.28);
  head.add(muzzle);
  const lift = FUR_LEN * 0.8;
  const nose = new THREE.Mesh(sphere(0.062, 28), noseMat);
  nose.scale.set(1.45, 0.92, 0.8);
  nose.position.set(0, -0.055, 0.43 + lift);
  nose.castShadow = true;
  head.add(nose);
  const stitchMat = new THREE.MeshStandardMaterial({ color: '#1c2468', roughness: 0.8 });
  const philtrum = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), stitchMat);
  philtrum.position.set(0, -0.12, 0.425 + lift);
  philtrum.rotation.x = -0.35;
  head.add(philtrum);
  const mouthGeo = new THREE.TorusGeometry(0.036, 0.0065, 8, 20, Math.PI);
  for (const s of [-1, 1]) {
    const mouth = new THREE.Mesh(mouthGeo, stitchMat);
    mouth.position.set(0.035 * s, -0.142, 0.41 + lift);
    mouth.rotation.set(-0.35, 0, Math.PI);
    head.add(mouth);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sphere(0.03, 20), eyeMat);
    eye.scale.set(1, 1.1, 0.7);
    eye.position.set(0.125 * s, 0.01, 0.33 + lift);
    head.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), shine);
    hl.position.set(0.125 * s + 0.01, 0.024, 0.355 + lift);
    head.add(hl);
    const ear = furBlob(0.1, 1, 0.95, 0.6);
    ear.position.set(0.31 * s, 0.17, -0.04);
    ear.rotation.z = -0.5 * s;
    head.add(ear);
  }

  // 네이비 우체부 모자 + 가죽 챙 + "Compassion" 자수
  const cap = new THREE.Group();
  cap.position.set(0, 0.28, -0.01);
  cap.rotation.set(-0.12, 0, 0.05);
  const capText = capTextTexture();
  capText.wrapS = THREE.RepeatWrapping;
  capText.offset.x = 0.5;
  const capSide = new THREE.MeshPhysicalMaterial({ map: capText, roughness: 0.9, sheen: 0.9, sheenColor: new THREE.Color('#7480ff'), sheenRoughness: 0.5 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.285, 0.13, 56, 1, true), capSide);
  band.position.y = 0.05;
  band.castShadow = true;
  cap.add(band);
  const crownTop = new THREE.Mesh(sphere(0.34, 48), navy);
  crownTop.scale.set(1.02, 0.24, 1.02);
  crownTop.position.set(0, 0.12, -0.01);
  crownTop.castShadow = true;
  cap.add(crownTop);
  const piping = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.008, 6, 56), navy);
  piping.rotation.x = Math.PI / 2;
  piping.position.y = 0.115;
  cap.add(piping);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.022, 40, 1, false, -Math.PI / 2, Math.PI), leather);
  brim.scale.set(1.05, 1, 0.85);
  brim.rotation.x = 0.22;
  brim.position.set(0, -0.012, 0.13);
  brim.castShadow = true;
  cap.add(brim);
  head.add(cap);

  // ---- 애니메이션 상태 ----
  let jumpV = 0, jumpY = 0, celebrateT = 0, t = 0, squash = 0;

  return {
    root,
    head,
    update(dt, energy = 0) {
      t += dt;
      jumpV -= 18 * dt;
      jumpY += jumpV * dt;
      if (jumpY < 0) { jumpY = 0; jumpV = 0; }
      body.position.y = jumpY;
      squash = THREE.MathUtils.damp(squash, 0, 10, dt);
      body.scale.set(1 + squash * 0.07, 1 + Math.sin(t * 2.2) * 0.01 - squash * 0.08, 1 + squash * 0.07);
      for (const a of arms) {
        const s = a.userData.side;
        const target = celebrateT > 0 ? 2.7 * s : (0.5 + energy * 0.8 * (0.6 + 0.4 * Math.sin(t * 12))) * s;
        a.rotation.z = THREE.MathUtils.damp(a.rotation.z, target, 10, dt);
      }
      if (celebrateT > 0) celebrateT -= dt;
    },
    hop(v = 2.2) {
      if (jumpY < 0.05) jumpV = v;
      squash = 1;
    },
    celebrate(seconds = 2.4) { celebrateT = seconds; },
  };
}
