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

function WaCheck() {
  return (
    <svg width="11" height="7" viewBox="0 0 14 8" fill="none" className="inline-block">
      <path d="M1 4l2.5 2.5L8 1" stroke="#53BDEB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 4l2.5 2.5L12 1" stroke="#53BDEB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CHAT_WALLPAPER =
  "#E5DDD5 url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.035'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

function WhatsAppScreen() {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-black"
      style={{ width: 210, height: 408, borderRadius: 24 }}
    >
      {/* Status bar + dynamic island */}
      <div className="relative flex h-[26px] flex-shrink-0 items-center justify-between bg-[#075E54] px-4">
        <span className="text-[9px] font-semibold text-white">9:41</span>
        <div className="absolute left-1/2 top-1/2 h-[16px] w-[62px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        <div className="flex items-center gap-1">
          <svg width="11" height="8" viewBox="0 0 14 10" fill="none">
            <rect x="0" y="6" width="2.5" height="4" rx="0.4" fill="white" />
            <rect x="3.5" y="4" width="2.5" height="6" rx="0.4" fill="white" />
            <rect x="7" y="2" width="2.5" height="8" rx="0.4" fill="white" />
            <rect x="10.5" y="0" width="2.5" height="10" rx="0.4" fill="white" opacity="0.4" />
          </svg>
          <svg width="15" height="8" viewBox="0 0 20 10" fill="none">
            <rect x="0.5" y="0.5" width="16" height="9" rx="2" stroke="white" strokeOpacity="0.6" />
            <rect x="2" y="2" width="12" height="6" rx="1" fill="white" />
          </svg>
        </div>
      </div>

      {/* Header do WhatsApp */}
      <div className="flex flex-shrink-0 items-center gap-2 bg-[#075E54] px-3 py-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-[10px] font-bold text-white">
          F
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold leading-none text-white">Salão da Ana</p>
          <p className="mt-0.5 flex items-center gap-1 text-[8px] text-[#A8D5CF]">
            <span className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-[#4FC3F7]" />
            online agora
          </p>
        </div>
        <MessageSquare className="size-3 text-white/70" aria-hidden />
      </div>

      {/* Conversa */}
      <div className="flex-1 space-y-1.5 overflow-hidden px-2.5 py-2.5" style={{ background: CHAT_WALLPAPER }}>
        <div className="flex justify-center">
          <span className="rounded-full bg-black/15 px-2 py-0.5 text-[7px] text-white">Hoje</span>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-lg rounded-tr-[2px] bg-[#DCF8C6] px-2 py-1 text-[8.5px] leading-tight text-slate-800 shadow-sm">
            Oi! Vocês têm horário hoje?
            <span className="ml-1 inline-flex items-center gap-0.5 align-bottom text-[6.5px] text-slate-500">
              9:41 <WaCheck />
            </span>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg rounded-tl-[2px] bg-white px-2 py-1 text-[8.5px] leading-tight text-slate-800 shadow-sm">
            Oi 😊 temos às <strong>14h</strong> e <strong>16h</strong>, qual prefere?
            <span className="ml-1 text-[6.5px] text-slate-400">9:41</span>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-lg rounded-tr-[2px] bg-[#DCF8C6] px-2 py-1 text-[8.5px] leading-tight text-slate-800 shadow-sm">
            14h pra mim!
            <span className="ml-1 inline-flex items-center gap-0.5 align-bottom text-[6.5px] text-slate-500">
              9:42 <WaCheck />
            </span>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg rounded-tl-[2px] bg-white px-2 py-1 text-[8.5px] leading-tight text-slate-800 shadow-sm">
            Agendado ✅ Te esperamos às <strong>14h</strong>!
            <span className="ml-1 text-[6.5px] text-slate-400">9:42</span>
          </div>
        </div>
      </div>

      {/* Barra de digitação */}
      <div className="flex flex-shrink-0 items-center gap-1.5 bg-[#F0F2F5] px-2 py-1.5">
        <div className="flex-1 rounded-full bg-white px-2.5 py-1 shadow-sm">
          <span className="text-[8px] text-gray-400">Mensagem</span>
        </div>
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#128C7E]">
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function PhoneCore() {
  const groupRef = useRef<Group>(null);
  const frontFacing = useFacingCamera(groupRef);

  return (
    <group ref={groupRef}>
      <RoundedBox args={[1.9, 3.7, 0.12]} radius={0.08} smoothness={8}>
        <meshPhysicalMaterial
          color="#111318"
          roughness={0.3}
          metalness={0.25}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
        />
      </RoundedBox>

      {/* Botões laterais */}
      <mesh position={[0.955, 0.55, 0]}>
        <boxGeometry args={[0.035, 0.42, 0.05]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[-0.955, 0.75, 0]}>
        <boxGeometry args={[0.035, 0.28, 0.05]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[-0.955, 0.35, 0]}>
        <boxGeometry args={[0.035, 0.28, 0.05]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Tela flush na face frontal */}
      <RoundedBox args={[1.86, 3.62, 0.01]} radius={0.07} smoothness={8} position={[0, 0, 0.066]}>
        <meshStandardMaterial color="#0b0f10" roughness={0.55} />
      </RoundedBox>

      {/* Traseira */}
      <RoundedBox
        args={[1.86, 3.62, 0.01]}
        radius={0.07}
        smoothness={8}
        position={[0, 0, -0.066]}
        rotation={[0, Math.PI, 0]}
      >
        <meshPhysicalMaterial
          color="#111827"
          roughness={0.4}
          metalness={0.35}
          clearcoat={0.4}
          clearcoatRoughness={0.3}
        />
      </RoundedBox>
      <mesh position={[0, 1.35, -0.072]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.1, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
      </mesh>

      {frontFacing ? (
        <Html
          transform
          occlude={false}
          position={[0, 0, 0.078]}
          distanceFactor={3.59}
          className="pointer-events-none select-none"
        >
          <WhatsAppScreen />
        </Html>
      ) : (
        <Html
          transform
          occlude={false}
          position={[0, 0, -0.078]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={3.59}
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
        <group scale={1.4}>
          <PhoneCore />
        </group>
      </Float>
      {LANDING_FEATURES.map((feature, index) => (
        <OrbitIcon
          key={feature.id}
          icon={feature.icon}
          index={index}
          total={LANDING_FEATURES.length}
          radius={3.8}
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
      className="relative h-[clamp(340px,58dvh,520px)] w-full"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0.4, 7.9], fov: 40 }}
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
