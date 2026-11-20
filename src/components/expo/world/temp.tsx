
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function StallModel() {
  // Dimensions in meters
  const width = 4;
  const depth = 6;
  const height = 4.5;

  const wallHeight = 3.8;
  const fasciaHeight = height - wallHeight;
  const frameSize = 0.07;

  const frameColor = "#55565a";
  const panelColor = "#eeeeF0";
  const fasciaColor = "#d6d6da";

  const frontZ = depth / 2;
  const backZ = -depth / 2;
  const leftX = -width / 2;
  const rightX = width / 2;

  return (
    <>
      {/* Back wall */}
      <mesh position={[0, wallHeight / 2, backZ + 0.05]}>
        <boxGeometry args={[width, wallHeight, 0.1]} />
        <meshStandardMaterial color={panelColor} />
      </mesh>

      {/* Left side wall */}
      <mesh position={[leftX + 0.05, wallHeight / 2, 0]}>
        <boxGeometry args={[0.1, wallHeight, depth]} />
        <meshStandardMaterial color="#e4e4e7" />
      </mesh>

      {/* Right side wall */}
      <mesh position={[rightX - 0.05, wallHeight / 2, 0]}>
        <boxGeometry args={[0.1, wallHeight, depth]} />
        <meshStandardMaterial color="#e4e4e7" />
      </mesh>

      {/* Front fascia / signboard */}
      <mesh
        position={[
          0,
          wallHeight + fasciaHeight / 2,
          frontZ - 0.05,
        ]}
      >
        <boxGeometry args={[width, fasciaHeight, 0.16]} />
        <meshStandardMaterial color={fasciaColor} />
      </mesh>

      {/* Back fascia */}
      <mesh
        position={[
          0,
          wallHeight + fasciaHeight / 2,
          backZ + 0.05,
        ]}
      >
        <boxGeometry args={[width, fasciaHeight, 0.16]} />
        <meshStandardMaterial color={fasciaColor} />
      </mesh>

      {/* Left fascia */}
      <mesh
        position={[
          leftX + 0.05,
          wallHeight + fasciaHeight / 2,
          0,
        ]}
      >
        <boxGeometry args={[0.16, fasciaHeight, depth]} />
        <meshStandardMaterial color={fasciaColor} />
      </mesh>

      {/* Right fascia */}
      <mesh
        position={[
          rightX - 0.05,
          wallHeight + fasciaHeight / 2,
          0,
        ]}
      >
        <boxGeometry args={[0.16, fasciaHeight, depth]} />
        <meshStandardMaterial color={fasciaColor} />
      </mesh>

      {/* Four metal corner posts */}
      {[
        [leftX, frontZ],
        [rightX, frontZ],
        [leftX, backZ],
        [rightX, backZ],
      ].map(([x, z], index) => (
        <mesh
          key={`post-${index}`}
          position={[x, height / 2, z]}
        >
          <boxGeometry args={[frameSize, height, frameSize]} />
          <meshStandardMaterial
            color={frameColor}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Horizontal front frame */}
      <mesh position={[0, wallHeight, frontZ]}>
        <boxGeometry args={[width, frameSize, frameSize]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>

      {/* Horizontal back frame */}
      <mesh position={[0, wallHeight, backZ]}>
        <boxGeometry args={[width, frameSize, frameSize]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>

      {/* Reception counter — no shadows */}
      <mesh position={[0, 0.45, 2.7]}>
        <boxGeometry args={[1.7, 0.84, 0.65]} />
        <meshStandardMaterial color="#eeeeF1" />
      </mesh>

      {/* Countertop */}
      <mesh position={[0, 0.89, 2.7]}>
        <boxGeometry args={[1.78, 0.06, 0.7]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </>
  );
}

export default function ExhibitionStall() {
  return (
    <div className="h-full w-full">
      <Canvas
        shadows={false}
        camera={{
          position: [8, 6, 9],
          fov: 42,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#ffffff"]} />

        <ambientLight intensity={2} />
        <directionalLight position={[5, 9, 7]} intensity={1.5} />

        <StallModel />

        <OrbitControls
          makeDefault
          target={[0, 2.1, 0]}
          minDistance={5}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}
