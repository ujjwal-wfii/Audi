// "use client";

// import { OrbitControls, Text } from "@react-three/drei";
// import { useMemo } from "react";
// import hallLayoutJson from "@/lib/expo/layout/hall-layout.json";
// import type {
// 	HallLayout,
// 	Stall,
// 	HallPath,
// 	StallType,
// } from "@/lib/expo/layout/schema";

// const layout = hallLayoutJson as HallLayout;

// const stallColors: Record<StallType, string> = {
// 	small: "#5598d1",
// 	medium: "#e6a23c",
// 	large: "#8a70d2",
// 	special: "#f49396",
// };

// const pathColor = "#a8bacb";

// function StallBlock({ stall }: { stall: Stall }) {
// 	const [width, height, depth] = layout.stall_sizes[stall.type];
// 	const [x, , z] = stall.center;

// 	return (
// 		<group position={[x, 0, z]}>
// 			{/* Stall dimensions in the JSON are width × height × depth.
//           The supplied center Y is the floor level, so lift the mesh by half its height. */}
// 			<mesh position={[0, height / 2, 0]} castShadow receiveShadow>
// 				<boxGeometry args={[width, height, depth]} />
// 				<meshStandardMaterial
// 					color={stallColors[stall.type]}
// 					roughness={0.82}
// 					metalness={0.02}
// 				/>
// 			</mesh>
// 			<Text
// 				position={[
// 					0,
// 					Math.min(height - 0.25, height * 0.72),
// 					depth / 2 + 0.035,
// 				]}
// 				fontSize={Math.min(0.8, Math.max(0.42, width * 0.09))}
// 				maxWidth={Math.max(1, width - 0.5)}
// 				color="#ffffff"
// 				anchorX="center"
// 				anchorY="middle"
// 				outlineWidth={0.025}
// 				outlineColor="#263449"
// 			>
// 				{stall.id}
// 			</Text>
// 		</group>
// 	);
// }

// function PathRegion({ path }: { path: HallPath }) {
// 	const [width, , depth] = path.size;
// 	const [x, , z] = path.center;
// 	const isExit = path.id.startsWith("Exit");

// 	return (
// 		<group position={[x, 0.025, z]}>
// 			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
// 				<planeGeometry args={[width, depth]} />
// 				<meshStandardMaterial
// 					color={isExit ? "#f87171" : pathColor}
// 					transparent
// 					opacity={isExit ? 0.65 : 0.38}
// 					roughness={1}
// 					depthWrite={false}
// 				/>
// 			</mesh>
// 		</group>
// 	);
// }

// function HallWalls() {
// 	const { min, max } = layout.hall;
// 	const wallHeight = layout.hall.ceiling_height;
// 	const wallThickness = 0.45;
// 	const hallWidth = max.x - min.x;
// 	const hallDepth = max.z - min.z;

// 	// Entrance is on +Z. There are no side-wall exit openings.
// 	const leftExitZ: number[] = [];
// 	const rightExitZ: number[] = [];
// 	const exitHalfWidth = 1.8;

// 	const sideSegments = useMemo(() => {
// 		const segments: Array<{
// 			x: number;
// 			z: number;
// 			width: number;
// 			depth: number;
// 		}> = [];
// 		const sides = [
// 			{ x: min.x, exits: leftExitZ },
// 			{ x: max.x, exits: rightExitZ },
// 		];
// 		for (const side of sides) {
// 			const sideX = side.x;
// 			let cursor = min.z;
// 			for (const exitZ of [...side.exits].sort((a, b) => a - b)) {
// 				const start = exitZ - exitHalfWidth;
// 				if (start > cursor) {
// 					segments.push({
// 						x: sideX,
// 						z: (cursor + start) / 2,
// 						width: wallThickness,
// 						depth: start - cursor,
// 					});
// 				}
// 				cursor = exitZ + exitHalfWidth;
// 			}
// 			if (cursor < max.z) {
// 				segments.push({
// 					x: sideX,
// 					z: (cursor + max.z) / 2,
// 					width: wallThickness,
// 					depth: max.z - cursor,
// 				});
// 			}
// 		}
// 		return segments;
// 	}, [min.x, max.x, min.z, max.z]);

// 	return (
// 		<group>
// 			{/* Rear wall at -Z */}
// 			<mesh position={[0, wallHeight / 2, min.z]}>
// 				<boxGeometry args={[hallWidth, wallHeight, wallThickness]} />
// 				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
// 			</mesh>

// 			{/* Front/entrance wall at +Z is split to leave an 8 m entry opening. */}
// 			<mesh position={[(min.x - 4) / 2, wallHeight / 2, max.z]}>
// 				<boxGeometry
// 					args={[Math.abs(min.x + 4), wallHeight, wallThickness]}
// 				/>
// 				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
// 			</mesh>
// 			<mesh position={[(max.x + 4) / 2, wallHeight / 2, max.z]}>
// 				<boxGeometry
// 					args={[Math.abs(max.x - 4), wallHeight, wallThickness]}
// 				/>
// 				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
// 			</mesh>

// 			{sideSegments.map((segment, index) => (
// 				<mesh
// 					key={index}
// 					position={[segment.x, wallHeight / 2, segment.z]}
// 				>
// 					<boxGeometry
// 						args={[segment.width, wallHeight, segment.depth]}
// 					/>
// 					<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
// 				</mesh>
// 			))}
// 		</group>
// 	);
// }

// function SpawnMarker() {
// 	const [x, , z] = layout.player_spawn.position;
// 	return (
// 		<group position={[x, 0, z]}>
// 			<mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
// 				<circleGeometry args={[0.75, 24]} />
// 				<meshBasicMaterial color="#16a34a" />
// 			</mesh>
// 			<mesh position={[0, 0.65, 0]}>
// 				<coneGeometry args={[0.32, 0.8, 12]} />
// 				<meshStandardMaterial color="#16a34a" />
// 			</mesh>
// 			<Text
// 				position={[0, 1.55, 0]}
// 				fontSize={0.55}
// 				color="#166534"
// 				anchorX="center"
// 				anchorY="middle"
// 				outlineWidth={0.025}
// 				outlineColor="#ffffff"
// 			>
// 				SPAWN
// 			</Text>
// 		</group>
// 	);
// }

// export default function HallScene() {
// 	const floorSize = layout.hall.floor_size;
// 	const floorCenter = layout.hall.floor_center;

// 	return (
// 		<>
// 			<color attach="background" args={["#dce6ef"]} />
// 			<ambientLight intensity={1.4} />
// 			<hemisphereLight args={["#ffffff", "#9ca3af", 1.2]} />
// 			<directionalLight position={[15, 28, 10]} intensity={2} />

// 			{/* Keep the floor's top surface at approximately Y=0. */}
// 			<mesh
// 				position={[floorCenter[0], -floorSize[1] / 2, floorCenter[2]]}
// 				receiveShadow
// 			>
// 				<boxGeometry args={floorSize} />
// 				<meshStandardMaterial color="#f1f5f9" roughness={1} />
// 			</mesh>

// 			{layout.paths.map((path) => (
// 				<PathRegion key={path.id} path={path} />
// 			))}

// 			{layout.stalls.map((stall) => (
// 				<StallBlock key={stall.id} stall={stall} />
// 			))}

// 			<HallWalls />
// 			<SpawnMarker />

// 			<gridHelper
// 				args={[60, 30, "#b8c7d6", "#d6e0e8"]}
// 				position={[0, 0.012, 0.5]}
// 			/>

// 			<OrbitControls
// 				makeDefault
// 				target={[0, 1.2, 0]}
// 				enablePan
// 				enableRotate
// 				enableZoom
// 				minDistance={20}
// 				maxDistance={105}
// 				maxPolarAngle={Math.PI / 2.05}
// 			/>
// 		</>
// 	);
// }

"use client";

import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import hallLayoutJson from "@/lib/expo/layout/hall-layout.json";
import type {
	HallLayout,
	Stall,
	HallPath,
	StallType,
} from "@/lib/expo/layout/schema";

const layout = hallLayoutJson as HallLayout;

const stallColors: Record<StallType, string> = {
	small: "#5598d1",
	medium: "#e6a23c",
	large: "#8a70d2",
	special: "#ef9a9a",
};

const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 4.2;
const RUN_SPEED = 6.4;
const EYE_HEIGHT = 1.65;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2.3;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

function circleHitsRect(x: number, z: number, radius: number, rect: Rect) {
	const nearestX = THREE.MathUtils.clamp(x, rect.minX, rect.maxX);
	const nearestZ = THREE.MathUtils.clamp(z, rect.minZ, rect.maxZ);
	return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2;
}

function StallBlock({ stall }: { stall: Stall }) {
	const [width, height, depth] = layout.stall_sizes[stall.type];
	const [x, , z] = stall.center;

	return (
		<group position={[x, 0, z]}>
			<mesh position={[0, height / 2, 0]} castShadow>
				<boxGeometry args={[width, height, depth]} />
				<meshStandardMaterial
					color={stallColors[stall.type]}
					roughness={0.84}
				/>
			</mesh>
			<Text
				position={[
					0,
					Math.min(height - 0.25, height * 0.72),
					depth / 2 + 0.04,
				]}
				fontSize={Math.min(0.8, Math.max(0.42, width * 0.09))}
				maxWidth={Math.max(1, width - 0.5)}
				color="#ffffff"
				anchorX="center"
				anchorY="middle"
				outlineWidth={0.025}
				outlineColor="#263449"
			>
				{stall.id}
			</Text>
		</group>
	);
}

function PathRegion({ path }: { path: HallPath }) {
	const [width, , depth] = path.size;
	const [x, , z] = path.center;
	const isExit = path.id.toLowerCase().includes("exit");

	return (
		<mesh position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
			<planeGeometry args={[width, depth]} />
			<meshStandardMaterial
				color={isExit ? "#f87171" : "#a8bacb"}
				transparent
				opacity={isExit ? 0.5 : 0.28}
				roughness={1}
				depthWrite={false}
			/>
		</mesh>
	);
}

function HallWalls() {
	const { min, max } = layout.hall;
	const wallHeight = layout.hall.ceiling_height;
	const thickness = 0.45;
	const width = max.x - min.x;

	// Keep entrance open across the central 8 m at +Z.
	const sideExitZ = [15, -4, -18];
	const exitHalfWidth = 1.8;
	const sideSegments = useMemo(() => {
		const segments: Array<{
			x: number;
			z: number;
			width: number;
			depth: number;
		}> = [];
		for (const sideX of [min.x, max.x]) {
			let cursor = min.z;
			for (const exitZ of [...sideExitZ].sort((a, b) => a - b)) {
				const start = exitZ - exitHalfWidth;
				if (start > cursor) {
					segments.push({
						x: sideX,
						z: (cursor + start) / 2,
						width: thickness,
						depth: start - cursor,
					});
				}
				cursor = exitZ + exitHalfWidth;
			}
			if (cursor < max.z) {
				segments.push({
					x: sideX,
					z: (cursor + max.z) / 2,
					width: thickness,
					depth: max.z - cursor,
				});
			}
		}
		return segments;
	}, [min.x, max.x, min.z, max.z]);

	return (
		<group>
			<mesh position={[0, wallHeight / 2, min.z]}>
				<boxGeometry args={[width, wallHeight, thickness]} />
				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
			</mesh>
			<mesh position={[(min.x - 4) / 2, wallHeight / 2, max.z]}>
				<boxGeometry
					args={[Math.abs(min.x + 4), wallHeight, thickness]}
				/>
				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
			</mesh>
			<mesh position={[(max.x + 4) / 2, wallHeight / 2, max.z]}>
				<boxGeometry
					args={[Math.abs(max.x - 4), wallHeight, thickness]}
				/>
				<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
			</mesh>
			{sideSegments.map((segment, i) => (
				<mesh key={i} position={[segment.x, wallHeight / 2, segment.z]}>
					<boxGeometry
						args={[segment.width, wallHeight, segment.depth]}
					/>
					<meshStandardMaterial color="#cbd5e1" roughness={0.9} />
				</mesh>
			))}
		</group>
	);
}

function PlayerController() {
	const playerRef = useRef<THREE.Group>(null);
	const keys = useRef<Record<string, boolean>>({});
	const yaw = useRef(0);
	const pitch = useRef(-0.08);
	const { camera, gl } = useThree();

	const blockers = useMemo<Rect[]>(
		() =>
			layout.stalls.map((stall) => ({
				minX: stall.footprint_x[0],
				maxX: stall.footprint_x[1],
				minZ: stall.footprint_z[0],
				maxZ: stall.footprint_z[1],
			})),
		[],
	);

	useEffect(() => {
		const canvas = gl.domElement;
		const lockPointer = () => {
			if (document.pointerLockElement !== canvas) {
				canvas.requestPointerLock();
			}
		};
		const onMouseMove = (event: MouseEvent) => {
			if (document.pointerLockElement !== canvas) return;
			yaw.current -= event.movementX * MOUSE_SENSITIVITY;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - event.movementY * MOUSE_SENSITIVITY,
				-MAX_PITCH,
				MAX_PITCH,
			);
		};

		canvas.addEventListener("click", lockPointer);
		document.addEventListener("mousemove", onMouseMove);

		return () => {
			canvas.removeEventListener("click", lockPointer);
			document.removeEventListener("mousemove", onMouseMove);
		};
	}, [gl]);

	useEffect(() => {
		const onDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			if (
				[
					"arrowup",
					"arrowdown",
					"arrowleft",
					"arrowright",
					" ",
				].includes(key)
			) {
				event.preventDefault();
			}
			keys.current[key] = true;
		};
		const onUp = (event: KeyboardEvent) => {
			keys.current[event.key.toLowerCase()] = false;
		};
		const clear = () => {
			keys.current = {};
		};

		window.addEventListener("keydown", onDown, { passive: false });
		window.addEventListener("keyup", onUp);
		window.addEventListener("blur", clear);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			window.removeEventListener("blur", clear);
		};
	}, []);

	useEffect(() => {
		const [x, y, z] = layout.player_spawn.position;
		playerRef.current?.position.set(x, y, z);
	}, [camera]);

	useFrame((_, rawDelta) => {
		const player = playerRef.current;
		if (!player) return;
		const delta = Math.min(rawDelta, 0.05);
		const k = keys.current;
		let forward =
			Number(Boolean(k.w || k.arrowup)) -
			Number(Boolean(k.s || k.arrowdown));
		let strafe =
			Number(Boolean(k.d || k.arrowright)) -
			Number(Boolean(k.a || k.arrowleft));
		const length = Math.hypot(forward, strafe);

		if (length > 0) {
			forward /= Math.max(1, length);
			strafe /= Math.max(1, length);
			const speed = k.shift ? RUN_SPEED : WALK_SPEED;
			const distance = speed * delta;
			const dx =
				(-Math.sin(yaw.current) * forward +
					Math.cos(yaw.current) * strafe) *
				distance;
			const dz =
				(-Math.cos(yaw.current) * forward -
					Math.sin(yaw.current) * strafe) *
				distance;
			const p = player.position;

			// Keep the avatar inside the hall and resolve X/Z separately for wall sliding.
			const nextX = THREE.MathUtils.clamp(
				p.x + dx,
				layout.hall.min.x + PLAYER_RADIUS,
				layout.hall.max.x - PLAYER_RADIUS,
			);
			if (
				!blockers.some((r) =>
					circleHitsRect(nextX, p.z, PLAYER_RADIUS, r),
				)
			)
				p.x = nextX;

			const nextZ = THREE.MathUtils.clamp(
				p.z + dz,
				layout.hall.min.z + PLAYER_RADIUS,
				layout.hall.max.z - PLAYER_RADIUS,
			);
			if (
				!blockers.some((r) =>
					circleHitsRect(p.x, nextZ, PLAYER_RADIUS, r),
				)
			)
				p.z = nextZ;

			player.rotation.y = Math.atan2(strafe, forward);
		}

		camera.position.set(
			player.position.x,
			player.position.y + EYE_HEIGHT,
			player.position.z,
		);
		camera.rotation.order = "YXZ";
		camera.rotation.y = yaw.current;
		camera.rotation.x = pitch.current;
	});

	return (
		<group ref={playerRef} position={layout.player_spawn.position} visible={false}>
			<mesh position={[0, 0.78, 0]} castShadow>
				<capsuleGeometry args={[0.34, 0.72, 4, 8]} />
				<meshStandardMaterial color="#0f766e" roughness={0.7} />
			</mesh>
			<mesh position={[0, 1.45, 0]} castShadow>
				<sphereGeometry args={[0.25, 12, 10]} />
				<meshStandardMaterial color="#f2c6a0" roughness={0.8} />
			</mesh>
			<mesh position={[0, 0.95, -0.29]}>
				<boxGeometry args={[0.2, 0.14, 0.12]} />
				<meshStandardMaterial color="#f8fafc" />
			</mesh>
			<mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<ringGeometry args={[0.48, 0.58, 24]} />
				<meshBasicMaterial color="#14b8a6" />
			</mesh>
		</group>
	);
}

export default function HallScene() {
	const floorSize = layout.hall.floor_size;
	const floorCenter = layout.hall.floor_center;

	return (
		<>
			<color attach="background" args={["#dce6ef"]} />
			<ambientLight intensity={1.25} />
			<hemisphereLight args={["#ffffff", "#9ca3af", 1]} />
			<directionalLight position={[15, 28, 10]} intensity={1.8} />

			<mesh
				position={[floorCenter[0], -floorSize[1] / 2, floorCenter[2]]}
			>
				<boxGeometry args={floorSize} />
				<meshStandardMaterial color="#f1f5f9" roughness={1} />
			</mesh>

			{layout.paths.map((path) => (
				<PathRegion key={path.id} path={path} />
			))}
			{layout.stalls.map((stall) => (
				<StallBlock key={stall.id} stall={stall} />
			))}
			<HallWalls />
			<PlayerController />
		</>
	);
}
