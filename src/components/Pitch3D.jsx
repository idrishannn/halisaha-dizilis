import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Minus, Plus, RefreshCw, RotateCw, Video } from 'lucide-react';
import { initials } from './Pitch.jsx';

/*
 * 3D saha. 2D sahadaki yüzde koordinatları (x soldan, y yukarıdan) birebir kullanılır:
 * saha düzlemi W x L birim, SVG'deki 200x300 viewBox ile aynı orana sahip.
 */
const W = 20;
const L = 30;
const toWorld = (x, y) => [(x / 100 - 0.5) * W, (y / 100 - 0.5) * L];
const toPct = (wx, wz) => [(wx / W + 0.5) * 100, (wz / L + 0.5) * 100];
const svgX = (v) => (v / 200 - 0.5) * W; // SVG birimi → dünya
const svgZ = (v) => (v / 300 - 0.5) * L;

const MIN_DIST = 9;
const MAX_DIST = 62;
const TAP_THRESHOLD = 5;

const VIEWS = {
  goal: { label: 'Kale arkası', pos: [0, 27, 30], target: [0, 0, -0.5] },
  top: { label: 'Kuş bakışı', pos: [0, 50, 3], target: [0, 0, 0.5] },
  stand: { label: 'Tribün', pos: [30, 17, 9], target: [0, 0, 0] },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fontReady = () => (document.fonts?.ready ?? Promise.resolve());

/* ------------------------------------------------------------------ dokular */

function useCanvasTexture(width, height, draw, deps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [width, height]);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (!alive) return;
      const ctx = texture.image.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      const done = draw(ctx, width, height);
      texture.needsUpdate = true;
      // çizim bir görsel bekliyorsa, yüklenince yeniden işaretle
      if (done?.then) done.then(() => { if (alive) texture.needsUpdate = true; });
    };
    run();
    fontReady().then(run); // font geç yüklenirse yazıları yeniden çiz
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Çim ve saha çizgileri: 2D SVG ile aynı ölçüler. */
function drawTurf(ctx, w, h) {
  const s = w / 200;
  ctx.fillStyle = '#1a7a3a';
  ctx.fillRect(0, 0, w, h);
  // biçim şeritleri
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 300; y += 37.5) ctx.fillRect(0, y * s, w, 18.75 * s);
  // suni çim dokusu
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n * 0.5;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.4;
  }
  ctx.putImageData(img, 0, 0);
  // çizgiler
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.3 * s;
  ctx.lineCap = 'round';
  const S = (v) => v * s;
  const rect = (x, y, rw, rh) => ctx.strokeRect(S(x), S(y), S(rw), S(rh));
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(S(x), S(y), S(r), 0, Math.PI * 2); ctx.fill(); };
  const arc = (x, y, r, a0, a1) => { ctx.beginPath(); ctx.arc(S(x), S(y), S(r), a0, a1); ctx.stroke(); };

  rect(8, 10, 184, 280);
  ctx.beginPath(); ctx.moveTo(S(8), S(150)); ctx.lineTo(S(192), S(150)); ctx.stroke();
  arc(100, 150, 26, 0, Math.PI * 2);
  dot(100, 150, 1.8);
  rect(48, 10, 104, 44); rect(76, 10, 48, 15); dot(100, 40, 1.5);
  rect(48, 246, 104, 44); rect(76, 275, 48, 15); dot(100, 260, 1.5);
  // ceza yayları (ceza sahası dışında kalan kısım)
  const a = Math.asin(16 / 22);
  arc(100, 40, 22, Math.PI / 2 - a, Math.PI / 2 + a);
  arc(100, 260, 22, -Math.PI / 2 - a, -Math.PI / 2 + a);
  // korner yayları
  arc(8, 10, 5, 0, Math.PI / 2);
  arc(192, 10, 5, Math.PI / 2, Math.PI);
  arc(8, 290, 5, -Math.PI / 2, 0);
  arc(192, 290, 5, Math.PI, Math.PI * 1.5);
}

function drawNet(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, h);
  ctx.moveTo(w, 0); ctx.lineTo(0, h);
  ctx.stroke();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Oyuncunun yüzü: fotoğraf ya da forma gradyanı + baş harfler, beyaz çerçeve, kaptan rozeti. */
function drawAvatar(ctx, size, { player, role, kit, isGK, captain }) {
  const c = size / 2;
  const ring = size * 0.055;
  const finish = () => {
    ctx.lineWidth = ring;
    ctx.strokeStyle = isGK ? kit.a : '#ffffff';
    ctx.beginPath(); ctx.arc(c, c, c - ring / 2, 0, Math.PI * 2); ctx.stroke();
    // üst parlama
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, c - ring, 0, Math.PI * 2); ctx.fill();
    if (captain) {
      const r = size * 0.15;
      const bx = size * 0.18;
      const by = size * 0.18;
      ctx.fillStyle = '#c6f432';
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = size * 0.02; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
      ctx.fillStyle = '#0b0f02';
      ctx.font = `900 ${r * 1.25}px "Geist Variable", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('C', bx, by + r * 0.06);
    }
  };

  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.clip();
  const bg = ctx.createRadialGradient(size * 0.3, size * 0.25, 0, size * 0.3, size * 0.25, size * 0.9);
  bg.addColorStop(0, kit.a);
  bg.addColorStop(0.8, kit.b);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (!player.image) {
    ctx.fillStyle = kit.ink;
    const text = initials(player.name) || role;
    ctx.font = `800 ${size * (text.length > 2 ? 0.26 : 0.34)}px "Geist Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c, c + size * 0.02);
    ctx.restore();
    finish();
    return null;
  }
  ctx.restore();
  return loadImage(player.image).then((img) => {
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();
    finish();
  }).catch(() => finish());
}

/** İsim etiketi: koyu hap, solda mevki rozeti. */
function drawLabel(ctx, w, h, { name, role, kit, isGK }) {
  ctx.font = `600 ${h * 0.4}px "Geist Variable", system-ui, sans-serif`;
  const roleFont = `700 ${h * 0.28}px "Geist Mono Variable", ui-monospace, monospace`;
  const label = (name || role).slice(0, 18);
  const nameW = ctx.measureText(label).width;
  ctx.font = roleFont;
  const roleW = ctx.measureText(role).width + h * 0.32;
  const pad = h * 0.14;
  const total = Math.min(w - 4, pad + roleW + h * 0.16 + nameW + h * 0.3);
  const x0 = (w - total) / 2;
  const r = h * 0.4;
  const y0 = h * 0.1;
  const ph = h * 0.8;

  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.beginPath(); ctx.roundRect(x0, y0, total, ph, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = isGK ? kit.a : 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.roundRect(x0 + pad, y0 + ph * 0.18, roleW, ph * 0.64, ph * 0.32); ctx.fill();
  ctx.fillStyle = isGK ? kit.ink : 'rgba(255,255,255,0.85)';
  ctx.font = roleFont;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(role, x0 + pad + roleW / 2, h / 2 + 1);

  ctx.fillStyle = '#fff';
  ctx.font = `600 ${h * 0.4}px "Geist Variable", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, 0, total - h * 0.25, h); ctx.clip();
  ctx.fillText(label, x0 + pad + roleW + h * 0.16, h / 2 + 2);
  ctx.restore();
}

/* ------------------------------------------------------------------ saha */

function Field() {
  const turf = useCanvasTexture(1024, 1536, drawTurf, []);
  return (
    <group>
      {/* saha dışı zemin */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[W + 16, L + 16]} />
        <meshStandardMaterial color="#0f3d22" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0a0f0c" roughness={1} />
      </mesh>
      {/* çim */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={turf} roughness={0.92} />
      </mesh>
      <Goal z={svgZ(10)} dir={-1} />
      <Goal z={svgZ(290)} dir={1} />
      <Fence />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Floodlight key={`${sx}${sz}`} x={sx * (W / 2 + 3.2)} z={sz * (L / 2 + 3.2)} />
      ))}
    </group>
  );
}

const postMat = new THREE.MeshStandardMaterial({ color: '#f4f4f5', roughness: 0.35, metalness: 0.2 });

function Goal({ z, dir }) {
  const net = useCanvasTexture(32, 32, drawNet, []);
  const width = svgX(118) - svgX(82);
  const height = 1.7;
  const depth = 1.1;
  const r = 0.06;
  const tex = useMemo(() => {
    const t = net.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(width * 4, height * 4);
    t.needsUpdate = true;
    return t;
  }, [net, width]);
  const netMat = (
    <meshStandardMaterial map={tex} alphaMap={tex} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
  );
  const back = z + dir * depth;
  return (
    <group>
      {/* direkler ve üst direk */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, height / 2, z]} material={postMat} castShadow>
          <cylinderGeometry args={[r, r, height, 12]} />
        </mesh>
      ))}
      <mesh position={[0, height, z]} rotation-z={Math.PI / 2} material={postMat} castShadow>
        <cylinderGeometry args={[r, r, width + r * 2, 12]} />
      </mesh>
      {/* ağ */}
      <mesh position={[0, height / 2, back]}>
        <planeGeometry args={[width, height]} />
        {netMat}
      </mesh>
      <mesh position={[0, height, (z + back) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[width, depth]} />
        {netMat}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, height / 2, (z + back) / 2]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[depth, height]} />
          {netMat}
        </mesh>
      ))}
    </group>
  );
}

/** Halı sahanın kafes çiti: direkler, üst boru ve şeffaf file. */
function Fence() {
  const net = useCanvasTexture(32, 32, drawNet, []);
  const h = 4;
  const hw = W / 2 + 1.6;
  const hl = L / 2 + 1.6;
  const sides = [
    { pos: [0, h / 2, -hl], rot: 0, len: hw * 2 },
    { pos: [0, h / 2, hl], rot: 0, len: hw * 2 },
    { pos: [-hw, h / 2, 0], rot: Math.PI / 2, len: hl * 2 },
    { pos: [hw, h / 2, 0], rot: Math.PI / 2, len: hl * 2 },
  ];
  const textures = useMemo(
    () => sides.map((s) => {
      const t = net.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(s.len * 2.2, h * 2.2);
      t.needsUpdate = true;
      return t;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net],
  );
  const posts = [];
  const step = 3.2;
  for (let x = -hw; x <= hw + 0.01; x += (hw * 2) / Math.round((hw * 2) / step)) posts.push([x, -hl], [x, hl]);
  for (let zz = -hl; zz <= hl + 0.01; zz += (hl * 2) / Math.round((hl * 2) / step)) posts.push([-hw, zz], [hw, zz]);
  return (
    <group>
      {sides.map((s, i) => (
        <group key={i} position={s.pos} rotation-y={s.rot}>
          <mesh>
            <planeGeometry args={[s.len, h]} />
            <meshStandardMaterial
              map={textures[i]} alphaMap={textures[i]} color="#d4d4d8" transparent opacity={0.22}
              side={THREE.DoubleSide} depthWrite={false}
            />
          </mesh>
          <mesh position-y={h / 2} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, s.len, 8]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {posts.map(([x, zz], i) => (
        <mesh key={i} position={[x, h / 2, zz]}>
          <cylinderGeometry args={[0.06, 0.06, h, 8]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Floodlight({ x, z }) {
  const h = 10;
  const angle = Math.atan2(-x, -z);
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={h / 2}>
        <cylinderGeometry args={[0.09, 0.14, h, 10]} />
        <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.35} />
      </mesh>
      <group position-y={h} rotation-y={angle}>
        <mesh rotation-x={-0.5}>
          <boxGeometry args={[1.8, 0.9, 0.18]} />
          <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh rotation-x={-0.5} position={[0, -0.05, 0.1]}>
          <planeGeometry args={[1.6, 0.7]} />
          <meshBasicMaterial color="#fffbe6" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ oyuncular */

function Player3D({ player, role, kit, captain, showName, target, dragging, isTarget, dim, onGrab }) {
  const group = useRef(null);
  const lift = useRef(null);
  const ring = useRef(null);
  const isGK = role === 'KL';
  const [hover, setHover] = useState(false);

  const avatar = useCanvasTexture(256, 256, (ctx, s) => drawAvatar(ctx, s, { player, role, kit, isGK, captain }), [
    player.image, player.name, role, kit.a, kit.b, kit.ink, captain,
  ]);
  const label = useCanvasTexture(512, 112, (ctx, w, h) => drawLabel(ctx, w, h, { name: player.name, role, kit, isGK }), [
    player.name, role, kit.a, kit.ink,
  ]);

  const [tx, tz] = toWorld(target.x, target.y);
  const first = useRef(true);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (first.current) { g.position.set(tx, 0, tz); first.current = false; }
    const k = 1 - Math.exp(-dt * (dragging ? 28 : 9));
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    const l = lift.current;
    const ly = dragging ? 0.7 : hover ? 0.12 : 0;
    l.position.y += (ly - l.position.y) * (1 - Math.exp(-dt * 14));
    const sc = isTarget ? 1.18 : dragging ? 1.1 : 1;
    l.scale.setScalar(l.scale.x + (sc - l.scale.x) * (1 - Math.exp(-dt * 14)));
    if (ring.current) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 7) * 0.08;
      ring.current.scale.setScalar(p);
    }
  });

  const jersey = useMemo(() => new THREE.MeshStandardMaterial({ color: kit.a, roughness: 0.55 }), [kit.a]);
  const shorts = useMemo(() => new THREE.MeshStandardMaterial({ color: kit.b, roughness: 0.6 }), [kit.b]);
  useEffect(() => () => { jersey.dispose(); shorts.dispose(); }, [jersey, shorts]);

  return (
    <group ref={group}>
      {/* yer halkası */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[0.5, 0.62, 40]} />
        <meshBasicMaterial color={isTarget ? '#c6f432' : kit.a} transparent opacity={dragging ? 0.25 : 0.55} toneMapped={false} />
      </mesh>
      {isTarget && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.85, 1.0, 48]} />
          <meshBasicMaterial color="#c6f432" toneMapped={false} />
        </mesh>
      )}

      <group ref={lift}>
        {/* şort + forma */}
        <mesh position-y={0.38} material={shorts} castShadow>
          <cylinderGeometry args={[0.3, 0.26, 0.42, 20]} />
        </mesh>
        <mesh position-y={0.92} material={jersey} castShadow>
          <capsuleGeometry args={[0.33, 0.46, 6, 20]} />
        </mesh>
        {/* kafa: her zaman kameraya dönük fotoğraf */}
        <Billboard position-y={1.86}>
          <mesh castShadow>
            <circleGeometry args={[0.62, 48]} />
            <meshBasicMaterial map={avatar} transparent opacity={dim ? 0.75 : 1} toneMapped={false} />
          </mesh>
        </Billboard>
        {showName && (
          <sprite position-y={2.85} scale={[3.3, 0.72, 1]}>
            <spriteMaterial map={label} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        )}
        {/* tutmayı kolaylaştıran görünmez alan */}
        <mesh
          position-y={1.3}
          onPointerDown={onGrab}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'grab'; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        >
          <cylinderGeometry args={[0.8, 0.8, 2.9, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function DragMarkers({ drag }) {
  const snapRef = useRef(null);
  useFrame((s) => {
    if (snapRef.current) snapRef.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 8) * 0.1);
  });
  if (!drag || drag.kind !== 'pitch') return null;
  const [ox, oz] = toWorld(drag.origin.x, drag.origin.y);
  const [bx, bz] = toWorld(drag.base.x, drag.base.y);
  const [dx, dz] = toWorld(clamp(drag.x, 2, 98), clamp(drag.y, 2, 98));
  const len = Math.hypot(dx - ox, dz - oz);
  return (
    <group>
      {/* başlangıç noktası hayaleti */}
      <mesh rotation-x={-Math.PI / 2} position={[ox, 0.02, oz]}>
        <ringGeometry args={[0.55, 0.65, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* rota */}
      {len > 0.3 && (
        <mesh position={[(ox + dx) / 2, 0.02, (oz + dz) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(dx - ox, dz - oz) + Math.PI / 2]}>
          <planeGeometry args={[len, 0.07]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      )}
      {drag.snap && (
        <mesh ref={snapRef} rotation-x={-Math.PI / 2} position={[bx, 0.03, bz]}>
          <ringGeometry args={[0.8, 0.95, 48]} />
          <meshBasicMaterial color="#c6f432" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ kamera */

/**
 * OrbitControls + yumuşak kamera geçişleri. `api` nesnesine dışarıdan çağrılacak
 * fonksiyonları yazar (görünüm ön ayarları, yakınlaştırma).
 */
function CameraRig({ api, autoRotate, onDistance }) {
  const controls = useRef(null);
  const { camera } = useThree();
  const anim = useRef(null);

  useEffect(() => {
    const go = (pos, target) => {
      // kalan dönme ivmesini sıfırla, yoksa geçiş bitince kamera kaymaya devam eder
      const c = controls.current;
      if (c) { c.enableDamping = false; c.update(); }
      anim.current = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) };
    };
    api.current = {
      controls: () => controls.current,
      view: (name) => go(VIEWS[name].pos, VIEWS[name].target),
      setDistance: (d) => {
        const c = controls.current;
        if (!c) return;
        const dir = camera.position.clone().sub(c.target).normalize();
        go(c.target.clone().add(dir.multiplyScalar(clamp(d, MIN_DIST, MAX_DIST))).toArray(), c.target.toArray());
      },
      zoom: (f) => {
        const c = controls.current;
        if (c) api.current.setDistance(camera.position.distanceTo(c.target) * f);
      },
    };
  }, [api, camera]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    const k = 1 - Math.exp(-dt * 6);
    camera.position.lerp(a.pos, k);
    c.target.lerp(a.target, k);
    c.update();
    if (camera.position.distanceTo(a.pos) < 0.02 && c.target.distanceTo(a.target) < 0.02) {
      anim.current = null;
      c.enableDamping = true;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={VIEWS.goal.target}
      enableDamping
      dampingFactor={0.08}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      maxPolarAngle={Math.PI / 2 - 0.06}
      autoRotate={autoRotate}
      autoRotateSpeed={0.7}
      zoomSpeed={0.9}
      onStart={() => {
        anim.current = null;
        if (controls.current) controls.current.enableDamping = true;
      }}
      onChange={() => {
        const c = controls.current;
        if (c) onDistance(camera.position.distanceTo(c.target));
      }}
    />
  );
}

/** Sürüklemeyi yöneten görünmez düzenek: işaretçiyi zemin düzlemine izdüşürür. */
function useGroundDrag({ api, onDragStart, onDragMove, onDragEnd, onTap }) {
  const { camera, gl } = useThree();
  const live = useRef(null);
  const handlers = useRef({});
  handlers.current = { onDragStart, onDragMove, onDragEnd, onTap };

  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const project = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const [x, y] = toPct(hit.x, hit.z);
      return { x, y, outside };
    };

    const move = (e) => {
      const d = live.current;
      if (!d || e.pointerId !== d.id) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < TAP_THRESHOLD) return;
        d.active = true;
        document.body.style.cursor = 'grabbing';
        handlers.current.onDragStart(d.slot);
      }
      const p = project(e);
      if (p) handlers.current.onDragMove(p.x, p.y, e.clientX, e.clientY, p.outside);
    };
    const end = (cancelled) => (e) => {
      const d = live.current;
      if (!d || e.pointerId !== d.id) return;
      live.current = null;
      document.body.style.cursor = '';
      const c = api.current?.controls();
      if (c) c.enabled = true;
      if (d.active) handlers.current.onDragEnd(cancelled);
      else if (!cancelled) handlers.current.onTap(d.slot);
    };
    const up = end(false);
    const cancel = end(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [api, camera, gl]);

  return (slot) => (e) => {
    if (e.button != null && e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    // OrbitControls aynı olayı bizden sonra alır; dönmeye başlamasın
    const c = api.current?.controls();
    if (c) c.enabled = false;
    live.current = { id: e.pointerId, slot, x0: e.clientX, y0: e.clientY, active: false };
  };
}

function Scene({ api, autoRotate, onDistance, lineup, positions, kit, gkKit, captainId, showNames, drag, handlers }) {
  const grab = useGroundDrag({ api, ...handlers });
  return (
    <>
      <color attach="background" args={['#0c0f10']} />
      <fog attach="fog" args={['#0c0f10', 45, 110]} />
      <hemisphereLight args={['#e8f5ff', '#0b2a16', 0.75]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[9, 22, 12]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-12, 18, -14]} intensity={0.6} />

      <Field />
      <DragMarkers drag={drag} />

      {lineup.map((p, i) => {
        const dragging = drag?.kind === 'pitch' && drag.slot === i;
        const target = dragging ? { x: clamp(drag.x, 2, 98), y: clamp(drag.y, 2, 98) } : positions[i];
        return (
          <Player3D
            key={p.id}
            player={p}
            role={positions[i].role}
            kit={i === 0 ? gkKit : kit}
            captain={captainId === p.id}
            showName={showNames}
            target={target}
            dragging={dragging}
            isTarget={drag?.over === i}
            dim={!!drag && !dragging && drag.over !== i}
            onGrab={grab(i)}
          />
        );
      })}

      <CameraRig api={api} autoRotate={autoRotate && !drag} onDistance={onDistance} />
    </>
  );
}

/* ------------------------------------------------------------------ dış bileşen */

export default function Pitch3D(props) {
  const api = useRef(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [view, setView] = useState('goal');
  const [dist, setDist] = useState(() => new THREE.Vector3(...VIEWS.goal.pos).distanceTo(new THREE.Vector3(...VIEWS.goal.target)));
  const [help, setHelp] = useState(true);
  const lastDist = useRef(dist);

  useEffect(() => {
    const t = setTimeout(() => setHelp(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const onDistance = (d) => {
    if (Math.abs(d - lastDist.current) > 0.15) {
      lastDist.current = d;
      setDist(d);
    }
  };

  // yakınlaştırma yüzdesi: 0 = en uzak, 100 = en yakın
  const zoomPct = Math.round(((MAX_DIST - dist) / (MAX_DIST - MIN_DIST)) * 100);

  return (
    <div className="absolute inset-0" onPointerDown={() => setHelp(false)}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: VIEWS.goal.pos, fov: 42, near: 0.1, far: 300 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        style={{ touchAction: 'none' }}
      >
        <Scene api={api} autoRotate={autoRotate} onDistance={onDistance} {...props} />
      </Canvas>

      {/* görünüm ön ayarları */}
      <div className="export-hide absolute left-[2.5cqw] top-[2.5cqw] flex flex-wrap gap-[1.2cqw]">
        {Object.entries(VIEWS).map(([id, v]) => (
          <button
            key={id}
            onClick={() => { setView(id); setAutoRotate(false); api.current?.view(id); }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ring-1 ring-inset backdrop-blur-md transition active:scale-95 ${
              view === id ? 'bg-white/90 text-zinc-900 ring-white' : 'bg-black/45 text-white/85 ring-white/15 hover:bg-black/60'
            }`}
          >
            {id === 'top' ? <Eye size={12} /> : <Video size={12} />}
            {v.label}
          </button>
        ))}
      </div>

      {/* yakınlaştırma kontrolü */}
      <div className="export-hide absolute right-[2.5cqw] top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-black/45 p-1 ring-1 ring-inset ring-white/15 backdrop-blur-md">
        <ZoomButton label="Yakınlaştır" onClick={() => api.current?.zoom(0.75)}><Plus size={15} /></ZoomButton>
        <input
          type="range"
          min={0}
          max={100}
          value={clamp(zoomPct, 0, 100)}
          aria-label="Yakınlık"
          onChange={(e) => {
            const d = MAX_DIST - (Number(e.target.value) / 100) * (MAX_DIST - MIN_DIST);
            api.current?.setDistance(d);
          }}
          className="zoom-slider h-28 w-6 cursor-pointer"
        />
        <ZoomButton label="Uzaklaştır" onClick={() => api.current?.zoom(1.33)}><Minus size={15} /></ZoomButton>
        <span className="my-0.5 h-px w-5 bg-white/15" />
        <ZoomButton label="Otomatik döndür" active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
          <RotateCw size={14} />
        </ZoomButton>
        <ZoomButton label="Görünümü sıfırla" onClick={() => { setView('goal'); setAutoRotate(false); api.current?.view('goal'); }}>
          <RefreshCw size={14} />
        </ZoomButton>
      </div>

      <div className="export-hide pointer-events-none absolute bottom-[2.5cqw] left-[2.5cqw] rounded-full bg-black/45 px-2 py-1 font-mono text-[10px] font-semibold text-white/70 ring-1 ring-inset ring-white/10 backdrop-blur-md">
        {clamp(zoomPct, 0, 100)}%
      </div>

      {help && (
        <div className="export-hide pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center px-4">
          <div className="animate-fade-up rounded-2xl bg-black/70 px-3.5 py-2 text-center text-[11px] leading-relaxed text-white/90 shadow-xl ring-1 ring-white/15">
            <b style={{ color: 'var(--accent)' }}>Sürükle</b> döndür · <b style={{ color: 'var(--accent)' }}>tekerlek / iki parmak</b> yakınlaştır
            <br />
            Oyuncuyu <b style={{ color: 'var(--accent)' }}>tut</b> taşı · <b style={{ color: 'var(--accent)' }}>dokun</b> düzenle
          </div>
        </div>
      )}
    </div>
  );
}

function ZoomButton({ label, onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90 ${
        active ? 'text-zinc-900' : 'text-white/85 hover:bg-white/15'
      }`}
      style={active ? { background: 'var(--accent)' } : undefined}
    >
      {children}
    </button>
  );
}
