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
function Vehicles({ frame }: { frame: Frame }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!mesh.current || !roof.current) return;
    const vehicles = frame.vehicles.slice(0, 1400);
    mesh.current.count = vehicles.length;
    roof.current.count = vehicles.length;
    vehicles.forEach((v, i) => {
      dummy.position.set(v.x, 1.05, v.z);
      dummy.rotation.set(0, v.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      color.set(
        v.speed < 0.1
          ? '#ffb56b'
          : ['#b7ddd9', '#34d3ae', '#8db2d4', '#d8d2b2', '#b5a1c9'][v.id % 5],
      );
      mesh.current!.setColorAt(i, color);
      dummy.position.y = 1.9;
      dummy.updateMatrix();
      roof.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    roof.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, 1400]} frustumCulled={false}>
        <boxGeometry args={[2.1, 1.3, 4.2]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, undefined, 1400]} frustumCulled={false}>
        <boxGeometry args={[1.7, 0.65, 2.2]} />
        <meshStandardMaterial color="#293e4b" metalness={0.4} roughness={0.3} />
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
    box(0, 0.02, 0, 228, 0.4, 228, '#334541');
    for (const r of roads) {
      box(0, 0.25, r, 226, 0.5, 18, '#64716d');
      box(0, 0.56, r, 226, 0.18, 13, '#202d36');
      box(r, 0.25, 0, 18, 0.5, 226, '#64716d');
      box(r, 0.57, 0, 13, 0.18, 226, '#202d36');
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
        const h = 7 + rng() * 24,
          w = 9 + rng() * 5,
          c = ['#314852', '#3b505a', '#405b61', '#2a404b', '#4e6266'][Math.floor(rng() * 5)];
        buildings.push({ x, z, w });
        box(x, h / 2 + 0.5, z, w, h, w, c);
        box(x, h + 0.8, z, w + 1, 0.65, w + 1, '#647d7d');
        box(x + 1, h + 1.8, z, w * 0.45, 2, w * 0.5, '#344851');
        for (let k = 0; k < Math.floor(h / 4); k++) {
          box(x, k * 4 + 3, z + w / 2 + 0.04, w * 0.76, 0.85, 0.06, '#709499');
          box(x + w / 2 + 0.04, k * 4 + 3, z, 0.06, 0.85, w * 0.76, '#668b8d');
        }
      }
    for (let i = 0; i < 160; i++) {
      const r = random(i * 185 + 4);
      const x = (r() - 0.5) * 213,
        z = (r() - 0.5) * 213;
      if (
        roads.some((v) => Math.abs(x - v) < 12 || Math.abs(z - v) < 12) ||
        buildings.some((b) => Math.abs(x - b.x) < 9 && Math.abs(z - b.z) < 9)
      )
        continue;
      box(x, 2, z, 0.7, 4, 0.7, '#696249');
      add(new THREE.IcosahedronGeometry(2.7, 1), x, 4.5, z, i % 2 ? '#367d67' : '#4c9272');
    }
    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    parts.forEach((g) => g.dispose());
    return merged;
  }, [junctions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.72} />
    </mesh>
  );
}
function District({ frame, junctions, selected, onSelect, heat }: Props) {
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
      <Vehicles frame={frame} />
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
      <div className="canvas-fallback">
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
        camera={{ position: [210, 195, 230], fov: 40, near: 1, far: 1200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#101c26']} />
        <fog attach="fog" args={['#101c26', 320, 670]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={['#a4dce4', '#29483c', 1.8]} />
        <directionalLight position={[60, 130, -80]} intensity={3} color="#c6eee4" />
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
