import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { Component, useMemo, useRef, useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Frame, junctionPositions, random, NAMES } from '../sim/engine';
type Props = {
  frame: Frame;
  junctions: 1 | 4;
  selected: number;
  onSelect: (i: number) => void;
  heat: boolean;
  camera: number;
  compact?: boolean;
  playing: boolean;
  speed: number;
};
function Box({
  position,
  size,
  color,
  ...rest
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  [key: string]: unknown;
}) {
  return (
    <mesh position={position} {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}
// Geometry is shared by every vehicle; only transforms and paint vary per instance.
function Vehicles({ frame, playing, speed }: Pick<Props, 'frame' | 'playing' | 'speed'>) {
  const body = useRef<THREE.InstancedMesh>(null);
  const detail = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const motion = useRef(new Map<number, { x: number; z: number; fromX: number; fromZ: number }>());
  const timing = useRef({ frame, start: 0, duration: 0 });
  const geometries = useMemo(() => {
    const shell = new THREE.BoxGeometry(1.85, 0.65, 4.2);
    shell.translate(0, 0.85, 0);
    const cabin = new THREE.BoxGeometry(1.65, 0.65, 2.15);
    const pos = cabin.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        pos.setX(i, pos.getX(i) * 0.8);
        pos.setZ(i, pos.getZ(i) * 0.72);
      }
    }
    cabin.computeVertexNormals();
    cabin.translate(0, 1.47, -0.15);
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, c: string) => {
      const colors = new Float32Array(g.attributes.position.count * 3);
      const tint = new THREE.Color(c);
      for (let i = 0; i < g.attributes.position.count; i++) tint.toArray(colors, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(g);
    };
    add(cabin, '#293d49');
    for (const x of [-0.92, 0.92])
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10);
        wheel.rotateZ(Math.PI / 2);
        wheel.translate(x, 0.47, z);
        add(wheel, '#1b2023');
      }
    for (const x of [-0.62, 0.62])
      for (const z of [-2.11, 2.11]) {
        const lamp = new THREE.BoxGeometry(0.4, 0.2, 0.04);
        lamp.translate(x, 0.88, z);
        add(lamp, z > 0 ? '#fff1c8' : '#a42622');
      }
    const top = new THREE.BoxGeometry(1.34, 0.08, 1.53);
    top.translate(0, 1.81, -0.15);
    const paint = mergeGeometries([shell, top]);
    const details = mergeGeometries(parts);
    shell.dispose();
    top.dispose();
    parts.forEach((g) => g.dispose());
    return { paint, details };
  }, []);
  useEffect(
    () => () => {
      geometries.paint.dispose();
      geometries.details.dispose();
    },
    [geometries],
  );
  useFrame(({ clock }) => {
    if (!body.current || !detail.current) return;
    const now = clock.elapsedTime;
    if (timing.current.frame !== frame) {
      const elapsed = frame.time - timing.current.frame.time;
      if (elapsed <= 0) motion.current.clear();
      motion.current.forEach((v) => {
        v.fromX = v.x;
        v.fromZ = v.z;
      });
      timing.current = {
        frame,
        start: now,
        duration: elapsed > 0 ? Math.min(elapsed / speed, 1) : 0,
      };
    }
    // Interpolate only between observed positions, never predict through a red signal.
    // Pause and resets show the exact recorded state immediately.
    const alpha =
      !playing || !timing.current.duration
        ? 1
        : Math.min(1, (now - timing.current.start) / timing.current.duration);
    const vehicles = frame.vehicles.slice(0, 1400);
    body.current.count = detail.current.count = vehicles.length;
    const present = new Set<number>();
    vehicles.forEach((v, i) => {
      present.add(v.id);
      const m = motion.current.get(v.id) ?? { x: v.x, z: v.z, fromX: v.x, fromZ: v.z };
      m.x = THREE.MathUtils.lerp(m.fromX, v.x, alpha);
      m.z = THREE.MathUtils.lerp(m.fromZ, v.z, alpha);
      motion.current.set(v.id, m);
      dummy.position.set(m.x, 0.68, m.z);
      dummy.rotation.set(0, v.angle, 0);
      dummy.updateMatrix();
      body.current!.setMatrixAt(i, dummy.matrix);
      detail.current!.setMatrixAt(i, dummy.matrix);
      color.set(['#e8e7e0', '#b8bcc0', '#415c71', '#b34b3b', '#d1c2a2', '#353b42'][v.id % 6]);
      body.current!.setColorAt(i, color);
    });
    for (const id of motion.current.keys()) if (!present.has(id)) motion.current.delete(id);
    body.current.instanceMatrix.needsUpdate = detail.current.instanceMatrix.needsUpdate = true;
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh
        ref={body}
        args={[geometries.paint, undefined, 1400]}
        frustumCulled={false}
        castShadow
      >
        <meshStandardMaterial roughness={0.3} metalness={0.25} />
      </instancedMesh>
      <instancedMesh
        ref={detail}
        args={[geometries.details, undefined, 1400]}
        frustumCulled={false}
      >
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.15} />
      </instancedMesh>
    </>
  );
}
function JunctionMarker({
  index,
  selected,
  onSelect,
}: {
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = selected ? '#42d6aa' : '#193b37';
    ctx.beginPath();
    ctx.roundRect(2, 2, 156, 68, 30);
    ctx.fill();
    ctx.strokeStyle = selected ? '#a5f3d8' : '#649d86';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = selected ? '#103b30' : '#c0e9d7';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), 80, 37);
    return new THREE.CanvasTexture(canvas);
  }, [index, selected]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={[0, 10, 0]}
      scale={[10, 4.5, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
function StaticCity({ junctions }: { junctions: 1 | 4 }) {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const roads = junctions === 1 ? [0] : [-45, 45];
    const rng = random(159);
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
      g.translate(x, y, z);
      const color = new THREE.Color(c);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(g);
    };
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string) =>
      add(new THREE.BoxGeometry(w, h, d), x, y, z, c);
    box(0, -2.6, 0, 240, 5, 240, '#15252c');
    box(0, 0.02, 0, 228, 0.4, 228, '#73806b');
    for (const r of roads) {
      box(0, 0.25, r, 226, 0.5, 18, '#b2aea1');
      box(0, 0.56, r, 226, 0.18, 13, '#383e40');
      box(r, 0.25, 0, 18, 0.5, 226, '#b2aea1');
      box(r, 0.57, 0, 13, 0.18, 226, '#383e40');
      for (let x = -108; x <= 108; x += 6) {
        if (roads.some((v) => Math.abs(x - v) < 9)) continue;
        box(x, 0.68, r, 3, 0.05, 0.18, '#a2a67d');
        box(r, 0.69, x, 0.18, 0.05, 3, '#a2a67d');
      }
    }
    const buildings: { x: number; z: number; w: number }[] = [];
    for (let x = -100; x <= 100; x += 18)
      for (let z = -100; z <= 100; z += 18) {
        if (
          roads.some((r) => Math.abs(x - r) < 16 || Math.abs(z - r) < 16) ||
          (x > 5 && x < 35 && z > 5 && z < 35)
        )
          continue;
        const type = Math.floor(rng() * 3);
        const h = type === 0 ? 5 + rng() * 5 : type === 1 ? 12 + rng() * 6 : 21 + rng() * 9;
        const w = 10 + rng() * 3;
        const c = ['#d1c6ae', '#acb3ad', '#b5997c', '#9bacae', '#c5c0b4'][Math.floor(rng() * 5)];
        buildings.push({ x, z, w });
        box(x, 0.6, z, w + 2.5, 0.6, w + 2.5, '#bcb6a5');
        box(x, h / 2 + 0.7, z, w, h, w, c);
        box(x, h + 0.8, z, w + 0.5, 0.4, w + 0.5, '#d4d0bf');
        // Flat roofs, parapets, utility tanks and stairwell enclosures.
        for (const sign of [-1, 1]) {
          box(x + (sign * w) / 2, h + 1.3, z, 0.25, 0.8, w, c);
          box(x, h + 1.3, z + (sign * w) / 2, w, 0.8, 0.25, c);
        }
        box(x + 2, h + 1.6, z - 2, 3, 1.6, 3, '#92958b');
        add(new THREE.CylinderGeometry(0.9, 0.9, 1.7, 10), x - 2, h + 1.8, z - 2, '#37434a');
        for (let floor = 0; floor < Math.floor(h / 3.2); floor++) {
          for (const offset of [-0.3, 0, 0.3])
            for (const sign of [-1, 1]) {
              const y = floor * 3.2 + 2.4;
              const glass = (floor + Math.round(x + z)) % 4 === 0 ? '#879695' : '#405660';
              box(x + offset * w, y, z + sign * (w / 2 + 0.02), 1.65, 1.5, 0.08, glass);
              box(x + sign * (w / 2 + 0.02), y, z + offset * w, 0.08, 1.5, 1.65, glass);
              if (type === 1) {
                box(x + offset * w, y - 0.8, z + sign * (w / 2 + 0.4), 2.1, 0.17, 0.9, '#d8d2be');
              }
            }
        }
        if (type === 0) {
          box(x, 2, z + w / 2 + 0.1, w * 0.7, 2.4, 0.15, '#344d52');
          box(x, 3.4, z + w / 2 + 0.8, w * 0.9, 0.25, 1.6, '#577b65');
        }
      }
    const tree = (x: number, z: number, n: number) => {
      add(new THREE.CylinderGeometry(0.17, 0.27, 3.6, 6), x, 2.3, z, '#76634c');
      for (let j = 0; j < 3; j++) {
        const crown = new THREE.IcosahedronGeometry(1.6 + j * 0.22, 1);
        crown.scale(1, 1.15, 1);
        add(
          crown,
          x + Math.sin(j * 2.1) * 0.9,
          4.2 + j * 0.5,
          z + Math.cos(j * 2.1) * 0.9,
          ['#526e3f', '#617f48', '#738951'][(n + j) % 3],
        );
      }
    };
    // Regular sidewalk planting and street furniture follow the actual road network.
    for (const r of roads)
      for (let p = -102; p <= 102; p += 17) {
        if (roads.some((v) => Math.abs(p - v) < 14)) continue;
        for (const side of [-1, 1]) {
          tree(p, r + side * 10.8, Math.abs(p));
          tree(r + side * 10.8, p, Math.abs(p));
          box(p + 4, 3.7, r + side * 8, 0.14, 6, 0.14, '#5a6060');
          box(p + 4, 6.7, r + side * 7.2, 0.24, 0.2, 1.8, '#b4b6aa');
          box(r + side * 8, 3.7, p + 4, 0.14, 6, 0.14, '#5a6060');
          box(r + side * 7.2, 6.7, p + 4, 1.8, 0.2, 0.24, '#b4b6aa');
          // Segmented curbs leave intersection crossings unobstructed.
          box(p, 0.75, r + side * 6.7, 12, 0.22, 0.3, '#c8c5b7');
          box(r + side * 6.7, 0.75, p, 0.3, 0.22, 12, '#c8c5b7');
        }
      }
    for (let i = 0; i < 100; i++) {
      const r = random(i * 185 + 4);
      const x = (r() - 0.5) * 213,
        z = (r() - 0.5) * 213;
      if (
        roads.some((v) => Math.abs(x - v) < 13 || Math.abs(z - v) < 13) ||
        buildings.some((b) => Math.abs(x - b.x) < 9 && Math.abs(z - b.z) < 9)
      )
        continue;
      tree(x, z, i);
    }
    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    parts.forEach((g) => g.dispose());
    return merged;
  }, [junctions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.72} />
    </mesh>
  );
}
function District({ frame, junctions, selected, onSelect, heat, playing, speed }: Props) {
  return (
    <group>
      <StaticCity junctions={junctions} />
      {junctionPositions(junctions).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.7, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <circleGeometry args={[15, 48]} />
            <meshBasicMaterial
              color={selected === i ? '#36dfb7' : '#70b0a9'}
              transparent
              opacity={selected === i ? 0.09 : 0.035}
              depthWrite={false}
            />
          </mesh>
          {selected === i && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.74, 0]}>
              <ringGeometry args={[14.7, 15, 64]} />
              <meshBasicMaterial color="#4be6bb" transparent opacity={0.8} />
            </mesh>
          )}
          {[0, 1, 2, 3].map((d) => (
            <group key={d} rotation={[0, (d * Math.PI) / 2, 0]}>
              <Box position={[7, 3.3, 10]} size={[0.35, 6, 0.35]} color="#83938c" />
              <Box position={[7, 6.6, 10]} size={[1.5, 2.9, 1]} color="#11232a" />
              {[0, 1, 2].map((k) => {
                const s = frame.signals[i];
                const active = s?.axis === (d % 2 === 0 ? 1 : 0);
                const lit =
                  k === 0
                    ? !active || s?.phase === 'clearance'
                    : k === 1
                      ? active && s?.phase === 'amber'
                      : active && s?.phase === 'green';
                const c = ['#ff6e76', '#ffc561', '#49ffd0'][k];
                return (
                  <mesh key={k} position={[7, 7.4 - k * 0.8, 10.55]}>
                    <sphereGeometry args={[0.3, 8, 6]} />
                    <meshStandardMaterial
                      color={lit ? c : '#253137'}
                      emissive={c}
                      emissiveIntensity={lit ? 2 : 0}
                    />
                  </mesh>
                );
              })}
              {Array.from({ length: 6 }, (_, k) => (
                <Box
                  key={k}
                  position={[-5 + k * 2, 0.72, 8.3]}
                  size={[1, 0.06, 2.1]}
                  color="#bcc7bd"
                />
              ))}
              {heat && (
                <mesh position={[3, 0.75, 22]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[4, 22]} />
                  <meshBasicMaterial
                    color={
                      (frame.queues[i]?.[d % 2 === 0 ? 1 : 0] ?? 0) > 5 ? '#ff9260' : '#24daa7'
                    }
                    transparent
                    opacity={0.25}
                  />
                </mesh>
              )}
            </group>
          ))}
          <JunctionMarker index={i} selected={selected === i} onSelect={() => onSelect(i)} />
        </group>
      ))}
      <Vehicles frame={frame} playing={playing} speed={speed} />
    </group>
  );
}
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="canvas-fallback" role="status" aria-live="polite">
        3D rendering is unavailable on this device. Metrics, experiments and simulation controls
        remain available.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function City(props: Props) {
  return (
    <Boundary>
      <Canvas
        key={props.camera}
        dpr={[1, 1.5]}
        shadows="soft"
        camera={{ position: [210, 195, 230], fov: 40, near: 1, far: 1200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#101c26']} />
        <fog attach="fog" args={['#101c26', 320, 670]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#d9e7f1', '#8a826a', 1.4]} />
        <directionalLight
          position={[-70, 140, 60]}
          intensity={2.4}
          color="#fff1d6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-160}
          shadow-camera-right={160}
          shadow-camera-top={160}
          shadow-camera-bottom={-160}
          shadow-camera-near={1}
          shadow-camera-far={350}
          shadow-normalBias={0.3}
          shadow-bias={-0.0001}
        />
        <District {...props} />
        <ContactShadows
          position={[0, -5.2, 0]}
          opacity={0.35}
          scale={380}
          blur={2.5}
          far={80}
          resolution={256}
          frames={1}
        />
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          minDistance={60}
          maxDistance={440}
          maxPolarAngle={Math.PI / 2.25}
          enableDamping
        />
      </Canvas>
    </Boundary>
  );
}
