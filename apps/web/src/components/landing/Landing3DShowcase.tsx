"use client";

import { Suspense, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { Quaternion, Vector3, type Group } from "three";
import { MessageSquare, type LucideIcon } from "lucide-react";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { LANDING_FEATURES } from "@/components/landing/features-data";

const scratchForward = /* @__PURE__ */ new Vector3();
const scratchQuat = /* @__PURE__ */ new Quaternion();
const scratchGroupPos = /* @__PURE__ */ new Vector3();
const scratchCameraDir = /* @__PURE__ */ new Vector3();

// O Html do drei (modo transform) achata o wrapper interno, então
// backface-visibility não funciona — decidimos qual lado renderizar
// comparando a normal do aparelho com a direção da câmera a cada frame.
function useFacingCamera(ref: RefObject<Group | null>) {
  const { camera } = useThree();
  const [front, setFront] = useState(true);
  const frontRef = useRef(true);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.getWorldQuaternion(scratchQuat);
    scratchForward.set(0, 0, 1).applyQuaternion(scratchQuat);
    ref.current.getWorldPosition(scratchGroupPos);
    scratchCameraDir.copy(camera.position).sub(scratchGroupPos).normalize();
    const isFront = scratchForward.dot(scratchCameraDir) > 0;
    if (isFront !== frontRef.current) {
      frontRef.current = isFront;
      setFront(isFront);
    }
  });

  return front;
}

function PhoneCore() {
  const groupRef = useRef<Group>(null);
  const frontFacing = useFacingCamera(groupRef);

  return (
    <group ref={groupRef}>
      <RoundedBox args={[1.9, 3.7, 0.22]} radius={0.16} smoothness={4}>
        <meshPhysicalMaterial
          color="#0f172a"
          roughness={0.35}
          metalness={0.2}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </RoundedBox>

      {/* Tela (frente) */}
      <mesh position={[0, 0, 0.12]}>
        <planeGeometry args={[1.62, 3.3]} />
        <meshStandardMaterial color="#16a34a" roughness={0.55} />
      </mesh>

      {/* Traseira */}
      <mesh position={[0, 0, -0.12]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.62, 3.3]} />
        <meshPhysicalMaterial
          color="#111827"
          roughness={0.4}
          metalness={0.35}
          clearcoat={0.4}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0, -0.125]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.16, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
      </mesh>

      {frontFacing ? (
        <>
          <Html
            transform
            occlude={false}
            position={[0, 1.28, 0.13]}
            distanceFactor={3.4}
            className="pointer-events-none select-none"
          >
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-white/90" aria-hidden />
              <span className="text-[9px] font-semibold text-white">Atendimento IA</span>
            </div>
          </Html>
          <Html
            transform
            occlude={false}
            position={[0, -0.1, 0.13]}
            distanceFactor={3.4}
            className="pointer-events-none select-none"
          >
            <div className="flex w-[150px] flex-col gap-2">
              <div className="ml-auto max-w-[75%] rounded-xl rounded-tr-sm bg-white/90 px-2.5 py-1.5 text-[9px] leading-tight text-slate-800 shadow-sm">
                Quero agendar um horário
              </div>
              <div className="mr-auto max-w-[80%] rounded-xl rounded-tl-sm bg-white/20 px-2.5 py-1.5 text-[9px] leading-tight text-white shadow-sm backdrop-blur-sm">
                Temos às 14h ou 16h, qual prefere?
              </div>
            </div>
          </Html>
        </>
      ) : (
        <Html
          transform
          occlude={false}
          position={[0, 0, -0.13]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={3.4}
          className="pointer-events-none select-none"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <MessageSquare className="size-4 text-brand-400" aria-hidden />
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-white/80">
              {APP_DISPLAY_NAME}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

type OrbitIconProps = {
  icon: LucideIcon;
  index: number;
  total: number;
  radius: number;
  reduced: boolean;
};

function OrbitIcon({ icon: Icon, index, total, radius, reduced }: OrbitIconProps) {
  const ref = useRef<Group>(null);
  const baseAngle = (index / total) * Math.PI * 2;
  const speed = 0.16;

  useFrame((state) => {
    if (!ref.current) return;
    const t = reduced ? 0 : state.clock.elapsedTime;
    const angle = baseAngle + t * speed;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.5 - 0.6;
    const y = Math.sin(angle * 1.3 + index) * 0.5;
    ref.current.position.set(x, y, z);
  });

  return (
    <group ref={ref} position={[Math.cos(baseAngle) * radius, 0, Math.sin(baseAngle) * radius * 0.5 - 0.6]}>
      <Html center distanceFactor={8} zIndexRange={[10, 0]} className="pointer-events-none select-none">
        <div className="flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-brand-600 shadow-lg shadow-black/10 backdrop-blur-sm">
          <Icon className="size-5" aria-hidden />
        </div>
      </Html>
    </group>
  );
}

function Scene({ reduced }: { reduced: boolean }) {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <pointLight position={[-3, -2, 2]} intensity={0.5} color="#22c55e" />
      <Float
        speed={reduced ? 0 : 1.2}
        rotationIntensity={reduced ? 0 : 0.25}
        floatIntensity={reduced ? 0 : 0.6}
      >
        <PhoneCore />
      </Float>
      {LANDING_FEATURES.map((feature, index) => (
        <OrbitIcon
          key={feature.id}
          icon={feature.icon}
          index={index}
          total={LANDING_FEATURES.length}
          radius={3.3}
          reduced={reduced}
        />
      ))}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!reduced}
        autoRotateSpeed={0.7}
        minPolarAngle={Math.PI / 2 - 0.5}
        maxPolarAngle={Math.PI / 2 + 0.35}
      />
    </>
  );
}

export default function Landing3DShowcase() {
  const reduced = Boolean(useReducedMotion());

  return (
    <div
      className="relative h-[420px] w-full sm:h-[480px] lg:h-[520px]"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0.6, 8], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
