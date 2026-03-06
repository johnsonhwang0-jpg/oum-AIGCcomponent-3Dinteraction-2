import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Text, Html, Billboard, Line, Grid } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Sliders, Info, Flame, Eye, Ruler, MoveHorizontal, Maximize, Minimize, ArrowRightLeft } from 'lucide-react';

// --- Constants ---
const MAX_DISTANCE = 10;
const LENS_POSITION = 0;

// --- Types ---
type LensType = 'convex' | 'concave';

// --- Geometry Helpers ---
const createLensGeometry = (type: LensType, radius: number) => {
  const points = [];
  const centerThickness = type === 'convex' ? 0.8 : 0.2; 
  const edgeThickness = type === 'convex' ? 0.1 : 0.8;
  const segments = 40;

  // Top surface (0 to Radius)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 to 1
    const r = t * radius;   // Distance from axis (x in Vector2)
    
    // Parabolic profile approximation
    const halfThickness = (centerThickness + (edgeThickness - centerThickness) * (t * t)) / 2;
    
    points.push(new THREE.Vector2(r, halfThickness));
  }

  // Bottom surface (Radius to 0)
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const r = t * radius;
    const halfThickness = (centerThickness + (edgeThickness - centerThickness) * (t * t)) / 2;
    points.push(new THREE.Vector2(r, -halfThickness));
  }
  
  // Close shape
  points.push(points[0]);
  
  return points;
};

// --- Components ---

function FloorRuler() {
  return (
    <group position={[0, -2, 0]}>
      {/* Floor Plane - Dark Reflective */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
            color="#020204" 
            roughness={0.1} 
            metalness={0.8} 
            envMapIntensity={0.5}
        />
      </mesh>
      
      {/* Grid - Subtle & Premium */}
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={1}
        cellColor="#333"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#444"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.01, 0]}
      />
      
      {/* Optical Axis Line on Floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[100, 0.02]} />
          <meshBasicMaterial color="#444" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function OpticalBench() {
    return (
        <group position={[0, -0.1, 0]}>
            {/* Main Rail - Brushed Metal */}
            <mesh position={[0, 0, 0]} receiveShadow castShadow>
                <boxGeometry args={[20, 0.15, 0.4]} />
                <meshStandardMaterial 
                    color="#444" 
                    metalness={0.9} 
                    roughness={0.3} 
                    envMapIntensity={1}
                />
            </mesh>
            {/* Ruler Markings on Rail */}
            {Array.from({ length: 21 }).map((_, i) => {
                const x = i - 10;
                return (
                    <group key={i} position={[x, 0.08, 0.15]}>
                        <mesh rotation={[-Math.PI/2, 0, 0]}>
                            <planeGeometry args={[0.01, 0.1]} />
                            <meshBasicMaterial color="#888" />
                        </mesh>
                        {Math.abs(x) % 2 === 0 && (
                             <Text 
                                position={[0, 0, 0.15]} 
                                rotation={[-Math.PI/2, 0, 0]} 
                                fontSize={0.1} 
                                color="#aaa"
                             >
                                {x}m
                             </Text>
                        )}
                    </group>
                );
            })}
        </group>
    );
}

function Candle({ position, height }: { position: [number, number, number], height: number }) {
  return (
    <group position={position}>
      {/* Base Holder */}
      <mesh position={[0, -0.1, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 0.2, 32]} />
          <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Candle Body - Wax Subsurface */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.08, height, 32]} />
        <meshPhysicalMaterial 
            color="#f5f5f5" 
            roughness={0.3} 
            transmission={0.2}
            thickness={0.5}
            emissive="#ffaa00" 
            emissiveIntensity={0.1} 
        />
      </mesh>
      {/* Wick */}
      <mesh position={[0, height + 0.05, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.1, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Flame */}
      <group position={[0, height + 0.15, 0]}>
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={[4, 2, 0.5]} toneMapped={false} />
        </mesh>
        <pointLight intensity={1.5} distance={8} color="#ffaa00" decay={2} castShadow />
      </group>
      {/* Base Label */}
      <Html position={[0, -0.6, 0]} center transform>
        <div className="bg-black/80 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full border border-white/10 font-mono tracking-wider shadow-xl">
          OBJECT
        </div>
      </Html>
    </group>
  );
}

function Lens({ type, focalLength }: { type: LensType; focalLength: number }) {
  const radius = 3.5;
  const points = useMemo(() => createLensGeometry(type, radius), [type, radius]);
  
  return (
    <group position={[LENS_POSITION, 0, 0]}>
      {/* Lens Mesh - High Quality Glass */}
      <mesh rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <latheGeometry args={[points, 64]} />
        <meshPhysicalMaterial
          transmission={1}
          opacity={1}
          roughness={0}
          thickness={1.5}
          ior={1.52}
          color={type === 'convex' ? "#cffafe" : "#fff7ed"}
          attenuationColor="#ffffff"
          attenuationDistance={10}
          clearcoat={1}
          clearcoatRoughness={0}
          toneMapped={false}
          envMapIntensity={1.5}
        />
      </mesh>
      
      {/* Rim - Subtle Tech Glow */}
      <mesh rotation={[0, Math.PI/2, 0]}>
        <torusGeometry args={[radius, 0.03, 16, 100]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {/* Stand/Holder - Minimalist */}
      <group position={[0, -radius - 0.1, 0]}>
        <mesh position={[0, radius/2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, radius, 16]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 0.1, 0.6]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Focal Points - Accurate Markers */}
      {/* F (Right) */}
      <group position={[focalLength, 0, 0]}>
        {/* Dot on Axis */}
        <mesh>
          <sphereGeometry args={[0.04]} />
          <meshBasicMaterial color={[3, 1, 1]} toneMapped={false} />
        </mesh>
        {/* Drop Line */}
        <Line points={[[0, 0, 0], [0, -0.8, 0]]} color="gray" transparent opacity={0.3} dashed dashScale={20} gapSize={10} />
        {/* Label */}
        <Text position={[0, -1.0, 0]} fontSize={0.2} color="#ffaaaa">
          F
        </Text>
      </group>

      {/* F' (Left) */}
      <group position={[-focalLength, 0, 0]}>
        {/* Dot on Axis */}
        <mesh>
          <sphereGeometry args={[0.04]} />
          <meshBasicMaterial color={[3, 1, 1]} toneMapped={false} />
        </mesh>
        {/* Drop Line */}
        <Line points={[[0, 0, 0], [0, -0.8, 0]]} color="gray" transparent opacity={0.3} dashed dashScale={20} gapSize={10} />
        {/* Label */}
        <Text position={[0, -1.0, 0]} fontSize={0.2} color="#ffaaaa">
          F'
        </Text>
      </group>
    </group>
  );
}

function ImagePhantom({ position, height, isReal, magnification }: { position: [number, number, number], height: number, isReal: boolean, magnification: number }) {
  // Calculate flame position based on magnification to match the ray tip exactly
  // Object flame is at height + 0.2. Image flame should be at (height + 0.2) * m
  // Here `height` is already objectHeight * m.
  // So we just need to add the scaled offset.
  // Note: magnification `m` is signed.
  
  const flameOffset = 0.2 * Math.abs(magnification);
  const flameY = height + (height < 0 ? -flameOffset : flameOffset);

  return (
    <group position={position}>
      {/* Ghost Candle */}
      <group>
         <mesh position={[0, height / 2, 0]} rotation={[0, 0, height < 0 ? Math.PI : 0]}>
            <cylinderGeometry args={[0.1, 0.1, Math.abs(height), 32]} />
            <meshStandardMaterial 
              color={isReal ? "#4ade80" : "#fbbf24"} 
              transparent 
              opacity={0.2} 
              emissive={isReal ? "#4ade80" : "#fbbf24"}
              emissiveIntensity={0.5}
              wireframe
            />
         </mesh>
         {/* Ghost Flame */}
         <mesh position={[0, flameY, 0]}>
            <sphereGeometry args={[0.08 * Math.abs(magnification)]} />
            <meshBasicMaterial 
                color={isReal ? [2, 10, 4] : [10, 8, 2]} 
                toneMapped={false} 
                transparent 
                opacity={0.8} 
            />
         </mesh>
      </group>

      {/* Screen (Only for real images) */}
      {isReal && (
        <group position={[0.1, 0, 0]}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.02, 4, 4]} />
                <meshStandardMaterial 
                    color="#111" 
                    roughness={0.2} 
                    metalness={0.8}
                    transparent
                    opacity={0.3}
                />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.02, 4, 4]} />
                <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.1} />
            </mesh>
            <Text position={[0, 2.2, 0]} fontSize={0.2} color="white">Screen</Text>
        </group>
      )}

      <Html position={[0, -0.5, 0]} center transform>
        <div className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap border ${isReal ? 'bg-green-900/80 border-green-500/50 text-green-200' : 'bg-orange-900/80 border-orange-500/50 text-orange-200'}`}>
          {isReal ? "REAL IMAGE" : "VIRTUAL IMAGE"}
        </div>
      </Html>
    </group>
  );
}

function RayLines({ points, color, dashed = false, width = 1 }: { points: THREE.Vector3[], color: [number, number, number], dashed?: boolean, width?: number }) {
    return (
        <Line
            points={points}
            color={new THREE.Color(...color)}
            lineWidth={width}
            dashed={dashed}
            dashScale={10}
            gapSize={10}
            opacity={dashed ? 0.5 : 1}
            transparent
            toneMapped={false} // Important for bloom
        />
    );
}

// --- Icons ---
const ConvexLensIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2C24 2 28 10 28 20C28 30 24 38 20 38C16 38 12 30 12 20C12 10 16 2 20 2Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2"/>
    <path d="M2 20H38" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
  </svg>
);

const ConcaveLensIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2C14 2 18 10 18 20C18 30 14 38 14 38H26C26 38 22 30 22 20C22 10 26 2 26 2H14Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2"/>
    <path d="M2 20H38" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
  </svg>
);

function Rays({ 
  objectPos, 
  objectHeight, 
  focalLength, 
  imagePos, 
  imageHeight,
  lensType,
  magnification
}: { 
  objectPos: number, 
  objectHeight: number, 
  focalLength: number, 
  imagePos: number, 
  imageHeight: number,
  lensType: LensType,
  magnification: number
}) {
  // Constants
  const LENS_X = 0;
  const RAY_EXT_LENGTH = 40; 

  // Points
  // Optical Axis is at y=0.
  const P_obj = new THREE.Vector3(objectPos, objectHeight + 0.2, 0); // Flame tip
  
  // Image tip: Scale the object tip position by magnification
  const P_img = new THREE.Vector3(imagePos, P_obj.y * magnification, 0); 
  
  const P_lens_center = new THREE.Vector3(LENS_X, 0, 0);
  
  // Foci
  // Note: focalLength prop is the magnitude (positive).
  const F_left = new THREE.Vector3(-focalLength, 0, 0);
  const F_right = new THREE.Vector3(focalLength, 0, 0);

  // --- Ray 1: Parallel to Axis ---
  // Hits lens at height of object
  const P_lens_top = new THREE.Vector3(LENS_X, P_obj.y, 0);

  // Incident 1
  const ray1_in = [P_obj, P_lens_top];
  
  // Refracted 1
  let dir1 = new THREE.Vector3();
  let ray1_virtual: THREE.Vector3[] = [];
  
  if (lensType === 'convex') {
      // Passes through F_right (+f)
      dir1.subVectors(F_right, P_lens_top).normalize();
      // Virtual: if image is virtual (u < f), extend backwards from P_lens_top to P_img
      if (imagePos < 0) ray1_virtual = [P_img, P_lens_top];
  } else {
      // Concave: Diverges as if coming from F_left (-f)
      dir1.subVectors(P_lens_top, F_left).normalize();
      // Virtual: Extend from F_left to lens (shows the rule clearly)
      ray1_virtual = [F_left, P_lens_top];
  }
  
  const ray1_end = new THREE.Vector3().copy(P_lens_top).add(dir1.multiplyScalar(RAY_EXT_LENGTH));
  const ray1_out = [P_lens_top, ray1_end];
  

  // --- Ray 2: Through Optical Center ---
  // Undeviated
  const dir2 = new THREE.Vector3().subVectors(P_lens_center, P_obj).normalize();
  const ray2_end = new THREE.Vector3().copy(P_obj).add(dir2.multiplyScalar(RAY_EXT_LENGTH));
  const ray2_full = [P_obj, ray2_end];
  
  // Virtual 2: It's the same line, but if image is virtual (left of lens), we highlight the segment P_img -> P_lens_center
  const ray2_virtual = imagePos < 0 ? [P_img, P_lens_center] : [];


  // --- Ray 3: Through Focal Point (or aiming at it) ---
  
  let P_lens_hit_3 = new THREE.Vector3();
  let ray3_in_target = new THREE.Vector3();
  let ray3_aim_extension: THREE.Vector3[] = [];

  if (lensType === 'convex') {
      // Incident ray passes through F_left (-f)
      ray3_in_target.copy(F_left);
  } else {
      // Incident ray aims at F_right (+f)
      ray3_in_target.copy(F_right);
  }

  // Calculate intersection with lens plane (x=0)
  // Line: P_obj + t * (Target - P_obj)
  // x = 0 => t = -P_obj.x / (Target.x - P_obj.x)
  
  const vec3 = new THREE.Vector3().subVectors(ray3_in_target, P_obj);
  
  const t3 = -P_obj.x / vec3.x;
  P_lens_hit_3.copy(P_obj).add(vec3.multiplyScalar(t3));
  
  // Incident 3
  const ray3_in = [P_obj, P_lens_hit_3];
  
  // If concave, show the "aiming" part behind the lens (dashed line to F_right)
  if (lensType === 'concave') {
      ray3_aim_extension = [P_lens_hit_3, F_right];
  }
  
  // Refracted 3: Parallel to axis
  const ray3_end = new THREE.Vector3(RAY_EXT_LENGTH, P_lens_hit_3.y, 0);
  const ray3_out = [P_lens_hit_3, ray3_end];
  
  // Virtual 3: Parallel back to image
  // The refracted ray is horizontal. The virtual extension goes left horizontally.
  let ray3_virtual: THREE.Vector3[] = [];
  if (imagePos < 0) {
      const ray3_virtual_start = new THREE.Vector3(-RAY_EXT_LENGTH, P_lens_hit_3.y, 0);
      ray3_virtual = [ray3_virtual_start, P_lens_hit_3];
  }

  // Colors for Bloom: Desaturated/Pastel Glow
  // High value (>1) for bloom, but balanced RGB for desaturation
  const color1: [number, number, number] = [2.0, 0.8, 0.8]; // Soft Red Glow
  const color2: [number, number, number] = [0.8, 2.0, 0.8]; // Soft Green Glow
  const color3: [number, number, number] = [0.8, 0.8, 2.0]; // Soft Blue Glow
  const colorVirtual: [number, number, number] = [1.5, 1.5, 1.5]; // Soft White Glow

  return (
    <group>
      {/* Ray 1 (Red) - Parallel -> Focal */}
      <RayLines points={ray1_in} color={color1} width={3} />
      <RayLines points={ray1_out} color={color1} width={3} />
      {ray1_virtual.length > 0 && <RayLines points={ray1_virtual} color={colorVirtual} dashed width={1} />}

      {/* Ray 2 (Green) - Center */}
      <RayLines points={ray2_full} color={color2} width={3} />
      {ray2_virtual.length > 0 && <RayLines points={ray2_virtual} color={colorVirtual} dashed width={1} />}

      {/* Ray 3 (Blue) - Focal -> Parallel */}
      <RayLines points={ray3_in} color={color3} width={3} />
      <RayLines points={ray3_out} color={color3} width={3} />
      {ray3_virtual.length > 0 && <RayLines points={ray3_virtual} color={colorVirtual} dashed width={1} />}
      {ray3_aim_extension.length > 0 && <RayLines points={ray3_aim_extension} color={colorVirtual} dashed width={1} />}
      
      {/* Intersection Marker */}
      <mesh position={P_img}>
          <sphereGeometry args={[0.05]} />
          <meshBasicMaterial color={[10, 10, 10]} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function App() {
  const [lensType, setLensType] = useState<LensType>('convex');
  const [focalLength, setFocalLength] = useState(2);
  const [objectDistance, setObjectDistance] = useState(4);
  const [showRays, setShowRays] = useState(true);

  // Physics
  const u = -objectDistance;
  const f = lensType === 'convex' ? focalLength : -focalLength;
  
  // 1/v = 1/f + 1/u
  const invV = (1 / f) + (1 / u);
  const v = Math.abs(invV) < 0.001 ? 1000 : 1 / invV; // Handle infinity
  const m = v / u;
  
  const objectHeight = 1.5;
  const imageHeight = objectHeight * m;
  const isReal = v > 0;

  // Camera Ref
  const controlsRef = useRef<any>(null);

  // Reset camera view
  const resetView = () => {
      if(controlsRef.current) {
          controlsRef.current.reset();
      }
  };

  return (
    <div className="w-full h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans overflow-hidden">
      {/* 3D Scene */}
      <div className="flex-1 relative h-[60vh] md:h-full order-2 md:order-1">
        <Canvas shadows camera={{ position: [0, 4, 12], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={['#020204']} />
          <fog attach="fog" args={['#020204', 10, 30]} />
          
          <ambientLight intensity={0.1} />
          <pointLight position={[5, 10, 5]} intensity={1.5} castShadow color="#ffffff" />
          <pointLight position={[-5, 5, -5]} intensity={0.5} color="#4444ff" />
          <Environment preset="city" />
          
          <group position={[0, -1.5, 0]}>
            <FloorRuler />
            <OpticalBench />
            
            <Candle position={[u, 0, 0]} height={objectHeight} />
            <Lens type={lensType} focalLength={focalLength} />
            
            {/* Limit image position for rendering sanity */}
            {Math.abs(v) < 20 && (
                <ImagePhantom 
                position={[v, 0, 0]} 
                height={imageHeight} 
                isReal={isReal} 
                magnification={m}
                />
            )}

            {showRays && (
                <Rays 
                objectPos={u} 
                objectHeight={objectHeight} 
                focalLength={focalLength} 
                imagePos={v} 
                imageHeight={imageHeight}
                lensType={lensType}
                magnification={m}
                />
            )}

            <ContactShadows opacity={0.6} scale={40} blur={2.5} far={4} color="#000000" />
            
            <EffectComposer>
                <Bloom luminanceThreshold={0.8} intensity={1.2} radius={0.6} mipmapBlur />
                <Vignette eskil={false} offset={0.1} darkness={1.2} />
            </EffectComposer>
          </group>

          <OrbitControls ref={controlsRef} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={5} maxDistance={25} />
        </Canvas>
        
        {/* Overlay Labels */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <h1 className="text-2xl font-bold flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
                <Eye className="w-6 h-6 text-white" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Optics Lab
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-2 ml-1">Interactive Ray Tracing Simulation</p>
        </div>

        <div className="absolute bottom-6 right-6 flex gap-2">
            <button onClick={resetView} className="p-2 bg-neutral-800/80 hover:bg-neutral-700 rounded-full backdrop-blur text-white transition-all border border-white/10" title="Reset Camera">
                <Maximize className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Controls & Explanation */}
      <div className="w-full md:w-[400px] bg-[#111] flex flex-col border-l border-white/5 order-1 md:order-2 z-10 shadow-2xl">
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {/* Controls Section */}
            <div className="space-y-8">
            
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Optical Element</label>
                <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => setLensType('convex')}
                    className={`relative group flex flex-col items-center justify-center gap-3 py-4 rounded-xl border transition-all ${lensType === 'convex' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-neutral-900/50 border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10 hover:text-white'}`}
                >
                    <div className={`p-2 rounded-full transition-colors ${lensType === 'convex' ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-gray-500 group-hover:text-white'}`}>
                        <ConvexLensIcon />
                    </div>
                    <span className="text-sm font-medium">Convex Lens</span>
                    {lensType === 'convex' && <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none" />}
                </button>
                
                <button 
                    onClick={() => setLensType('concave')}
                    className={`relative group flex flex-col items-center justify-center gap-3 py-4 rounded-xl border transition-all ${lensType === 'concave' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-neutral-900/50 border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10 hover:text-white'}`}
                >
                    <div className={`p-2 rounded-full transition-colors ${lensType === 'concave' ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-gray-500 group-hover:text-white'}`}>
                        <ConcaveLensIcon />
                    </div>
                    <span className="text-sm font-medium">Concave Lens</span>
                    {lensType === 'concave' && <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none" />}
                </button>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 block">Parameters</label>
                
                <div className="space-y-6">
                    <div className="group">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-300 flex items-center gap-2">
                                <ArrowRightLeft className="w-4 h-4 text-gray-500" />
                                Object Distance (u)
                            </span>
                            <span className="font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{objectDistance.toFixed(1)}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="8" 
                            step="0.1" 
                            value={objectDistance} 
                            onChange={(e) => setObjectDistance(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500 group-hover:accent-blue-400 transition-all"
                        />
                        <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                            <span>0.5m</span>
                            <span>8.0m</span>
                        </div>
                    </div>

                    <div className="group">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-300 flex items-center gap-2">
                                <Maximize className="w-4 h-4 text-gray-500" />
                                Focal Length (f)
                            </span>
                            <span className="font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{focalLength.toFixed(1)}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="4" 
                            step="0.1" 
                            value={focalLength} 
                            onChange={(e) => setFocalLength(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500 group-hover:accent-blue-400 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Live Data */}
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Image Properties</label>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border ${isReal ? 'bg-green-500/10 border-green-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                        <div className={`text-xs font-bold uppercase mb-1 ${isReal ? 'text-green-500' : 'text-orange-500'}`}>Type</div>
                        <div className="text-sm font-medium text-white">{isReal ? 'Real' : 'Virtual'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-900 border border-white/5">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Orientation</div>
                        <div className="text-sm font-medium text-white">{m < 0 ? 'Inverted' : 'Upright'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-900 border border-white/5">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Magnification</div>
                        <div className="text-sm font-medium text-white font-mono">{Math.abs(m).toFixed(2)}x</div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-900 border border-white/5">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Position (v)</div>
                        <div className="text-sm font-medium text-white font-mono">{v.toFixed(2)}m</div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl">
                <h3 className="text-blue-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                    <Info className="w-3 h-3" />
                    The Math
                </h3>
                <div className="font-mono text-xs text-blue-200 space-y-1">
                    <p>1/v - 1/u = 1/f</p>
                    <p className="opacity-70">1/{v.toFixed(2)} - 1/{-objectDistance.toFixed(2)} = 1/{f.toFixed(2)}</p>
                </div>
            </div>

            </div>
        </div>
        
        {/* Footer Toggle */}
        <div className="p-4 border-t border-white/5 bg-[#0f0f0f]">
             <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Show Ray Paths</span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${showRays ? 'bg-blue-600' : 'bg-neutral-700'}`} onClick={() => setShowRays(!showRays)}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showRays ? 'left-6' : 'left-1'}`} />
                </div>
             </label>
        </div>
      </div>
    </div>
  );
}
