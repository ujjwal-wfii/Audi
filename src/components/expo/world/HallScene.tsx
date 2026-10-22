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
const WALK_SPEED = 2.2;
const RUN_SPEED = 4.4;
const EYE_HEIGHT = 1.65;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2.3;
const MOVEMENT_TURN_SPEED = 2.4;
const MAX_MOVEMENT_TURN_RATE = 2.2;

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

// function PlayerController() {
// 	const playerRef = useRef<THREE.Group>(null);
// 	const keys = useRef<Record<string, boolean>>({});
// 	const yaw = useRef(0);
// 	const pitch = useRef(-0.08);
// 	const lastMouseMove = useRef(0);
// 	const { camera, gl } = useThree();

// 	const blockers = useMemo<Rect[]>(
// 		() =>
// 			layout.stalls.map((stall) => ({
// 				minX: stall.footprint_x[0],
// 				maxX: stall.footprint_x[1],
// 				minZ: stall.footprint_z[0],
// 				maxZ: stall.footprint_z[1],
// 			})),
// 		[],
// 	);

// 	useEffect(() => {
// 		const canvas = gl.domElement;
// 		const lockPointer = () => {
// 			if (document.pointerLockElement !== canvas) {
// 				canvas.requestPointerLock();
// 			}
// 		};
// 		const onMouseMove = (event: MouseEvent) => {
// 			if (document.pointerLockElement !== canvas) return;
// 			const mx = THREE.MathUtils.clamp(event.movementX, -100, 100);
// 			const my = THREE.MathUtils.clamp(event.movementY, -100, 100);
// 			yaw.current -= mx * MOUSE_SENSITIVITY;
// 			pitch.current = THREE.MathUtils.clamp(
// 				pitch.current - my * MOUSE_SENSITIVITY,
// 				-MAX_PITCH,
// 				MAX_PITCH,
// 			);
// 			lastMouseMove.current = performance.now();
// 		};

// 		canvas.addEventListener("click", lockPointer);
// 		document.addEventListener("mousemove", onMouseMove);
// 		return () => {
// 			canvas.removeEventListener("click", lockPointer);
// 			document.removeEventListener("mousemove", onMouseMove);
// 		};
// 	}, [gl]);

// 	useEffect(() => {
// 		const onDown = (event: KeyboardEvent) => {
// 			const key = event.key.toLowerCase();
// 			if (
// 				[
// 					"arrowup",
// 					"arrowdown",
// 					"arrowleft",
// 					"arrowright",
// 					" ",
// 				].includes(key)
// 			) {
// 				event.preventDefault();
// 			}
// 			keys.current[key] = true;
// 		};
// 		const onUp = (event: KeyboardEvent) => {
// 			keys.current[event.key.toLowerCase()] = false;
// 		};
// 		const clear = () => {
// 			keys.current = {};
// 		};

// 		window.addEventListener("keydown", onDown, { passive: false });
// 		window.addEventListener("keyup", onUp);
// 		window.addEventListener("blur", clear);
// 		return () => {
// 			window.removeEventListener("keydown", onDown);
// 			window.removeEventListener("keyup", onUp);
// 			window.removeEventListener("blur", clear);
// 		};
// 	}, []);

// 	useEffect(() => {
// 		const [x, y, z] = layout.player_spawn.position;
// 		playerRef.current?.position.set(x, y, z);
// 	}, []);

// 	useFrame((_, rawDelta) => {
// 		const player = playerRef.current;
// 		if (!player) return;

// 		const delta = Math.min(rawDelta, 0.05);
// 		const k = keys.current;

// 		// World-relative input: W = -Z, S = +Z, A = -X, D = +X
// 		let ix =
// 			Number(Boolean(k.d || k.arrowright)) -
// 			Number(Boolean(k.a || k.arrowleft));
// 		let iz =
// 			Number(Boolean(k.s || k.arrowdown)) -
// 			Number(Boolean(k.w || k.arrowup));
// 		const length = Math.hypot(ix, iz);

// 		if (length > 0) {
// 			ix /= length;
// 			iz /= length;

// 			const speed = k.shift ? RUN_SPEED : WALK_SPEED;
// 			const distance = speed * delta;
// 			const dx = ix * distance;
// 			const dz = iz * distance;
// 			const p = player.position;

// 			// Resolve X and Z separately for wall/stall sliding
// 			const nextX = THREE.MathUtils.clamp(
// 				p.x + dx,
// 				layout.hall.min.x + PLAYER_RADIUS,
// 				layout.hall.max.x - PLAYER_RADIUS,
// 			);
// 			if (
// 				!blockers.some((r) =>
// 					circleHitsRect(nextX, p.z, PLAYER_RADIUS, r),
// 				)
// 			)
// 				p.x = nextX;

// 			const nextZ = THREE.MathUtils.clamp(
// 				p.z + dz,
// 				layout.hall.min.z + PLAYER_RADIUS,
// 				layout.hall.max.z - PLAYER_RADIUS,
// 			);
// 			if (
// 				!blockers.some((r) =>
// 					circleHitsRect(p.x, nextZ, PLAYER_RADIUS, r),
// 				)
// 			)
// 				p.z = nextZ;

// 			// Turn the view toward the input direction (not the blocked/slid one),
// 			// but not while the user is actively moving the mouse.
// 			const mouseActive = performance.now() - lastMouseMove.current < 150;
// 			if (!mouseActive) {
// 				const targetYaw = Math.atan2(-ix, -iz);
// 				const yawDelta =
// 					THREE.MathUtils.euclideanModulo(
// 						targetYaw - yaw.current + Math.PI,
// 						Math.PI * 2,
// 					) - Math.PI;
// 				const easedTurn =
// 					yawDelta * (1 - Math.exp(-MOVEMENT_TURN_SPEED * delta));
// 				yaw.current += THREE.MathUtils.clamp(
// 					easedTurn,
// 					-MAX_MOVEMENT_TURN_RATE * delta,
// 					MAX_MOVEMENT_TURN_RATE * delta,
// 				);
// 			}
// 		}

// 		player.rotation.y = yaw.current;

// 		camera.position.set(
// 			player.position.x,
// 			player.position.y + EYE_HEIGHT,
// 			player.position.z,
// 		);
// 		camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
// 	});

// 	return (
// 		<group
// 			ref={playerRef}
// 			position={layout.player_spawn.position}
// 			visible={false}
// 		>
// 			<mesh position={[0, 0.78, 0]} castShadow>
// 				<capsuleGeometry args={[0.34, 0.72, 4, 8]} />
// 				<meshStandardMaterial color="#0f766e" roughness={0.7} />
// 			</mesh>
// 			<mesh position={[0, 1.45, 0]} castShadow>
// 				<sphereGeometry args={[0.25, 12, 10]} />
// 				<meshStandardMaterial color="#f2c6a0" roughness={0.8} />
// 			</mesh>
// 			<mesh position={[0, 0.95, -0.29]}>
// 				<boxGeometry args={[0.2, 0.14, 0.12]} />
// 				<meshStandardMaterial color="#f8fafc" />
// 			</mesh>
// 			<mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
// 				<ringGeometry args={[0.48, 0.58, 24]} />
// 				<meshBasicMaterial color="#14b8a6" />
// 			</mesh>
// 		</group>
// 	);
// }
// Tuning constants (add near your other constants)
const ACCELERATION = 10; // higher = snappier start/stop
const TURN_SPEED = 1.8; // rad/s for arrow-key turning
const BOB_FREQUENCY = 1.9; // steps per metre travelled
const BOB_HEIGHT = 0.035; // vertical bob in metres
const BOB_SWAY = 0.02; // side-to-side sway in metres
const RUN_BOB_SCALE = 1.4; // bigger bob when running

function PlayerController() {
	const playerRef = useRef<THREE.Group>(null);
	const keys = useRef<Record<string, boolean>>({});
	const yaw = useRef(0);
	const pitch = useRef(-0.08);
	const velocity = useRef(new THREE.Vector2(0, 0)); // x, z in world space
	const bobPhase = useRef(0);
	const bobAmount = useRef(0); // smoothed 0..1 so the bob fades in/out
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

	// Mouse look
	useEffect(() => {
		const canvas = gl.domElement;
		const lockPointer = () => {
			if (document.pointerLockElement !== canvas) {
				canvas.requestPointerLock();
			}
		};
		const onMouseMove = (event: MouseEvent) => {
			if (document.pointerLockElement !== canvas) return;
			const mx = THREE.MathUtils.clamp(event.movementX, -100, 100);
			const my = THREE.MathUtils.clamp(event.movementY, -100, 100);
			yaw.current -= mx * MOUSE_SENSITIVITY;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - my * MOUSE_SENSITIVITY,
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

	// Keyboard
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

	// Spawn
	useEffect(() => {
		const [x, y, z] = layout.player_spawn.position;
		playerRef.current?.position.set(x, y, z);
	}, []);

	useFrame((_, rawDelta) => {
		const player = playerRef.current;
		if (!player) return;

		const delta = Math.min(rawDelta, 0.05);
		const k = keys.current;
		const vel = velocity.current;
		const p = player.position;

		// Arrow left/right turn the view
		yaw.current +=
			(Number(Boolean(k.arrowleft)) - Number(Boolean(k.arrowright))) *
			TURN_SPEED *
			delta;

		// Input relative to where you are looking
		// Backward movement is intentionally disabled.
		let forward = Number(Boolean(k.w || k.arrowup));
		let strafe = Number(Boolean(k.d)) - Number(Boolean(k.a));
		const length = Math.hypot(forward, strafe);
		if (length > 1) {
			forward /= length;
			strafe /= length;
		}

		// Target velocity in world space
		const maxSpeed = k.shift ? RUN_SPEED : WALK_SPEED;
		const sin = Math.sin(yaw.current);
		const cos = Math.cos(yaw.current);
		const targetVx = (-sin * forward + cos * strafe) * maxSpeed;
		const targetVz = (-cos * forward - sin * strafe) * maxSpeed;

		// Smoothly accelerate toward the target (and decelerate to a stop)
		const blend = 1 - Math.exp(-ACCELERATION * delta);
		vel.x += (targetVx - vel.x) * blend;
		vel.y += (targetVz - vel.y) * blend;
		if (Math.abs(vel.x) < 0.001) vel.x = 0;
		if (Math.abs(vel.y) < 0.001) vel.y = 0;

		// Move with per-axis collision so you slide along walls and stalls
		if (vel.x !== 0) {
			const nextX = THREE.MathUtils.clamp(
				p.x + vel.x * delta,
				layout.hall.min.x + PLAYER_RADIUS,
				layout.hall.max.x - PLAYER_RADIUS,
			);
			if (
				blockers.some((r) =>
					circleHitsRect(nextX, p.z, PLAYER_RADIUS, r),
				)
			) {
				vel.x = 0;
			} else {
				p.x = nextX;
			}
		}
		if (vel.y !== 0) {
			const nextZ = THREE.MathUtils.clamp(
				p.z + vel.y * delta,
				layout.hall.min.z + PLAYER_RADIUS,
				layout.hall.max.z - PLAYER_RADIUS,
			);
			if (
				blockers.some((r) =>
					circleHitsRect(p.x, nextZ, PLAYER_RADIUS, r),
				)
			) {
				vel.y = 0;
			} else {
				p.z = nextZ;
			}
		}

		// Head bob, driven by actual distance travelled
		const speed = vel.length();
		const moving = speed > 0.1;
		const targetBob = moving
			? Math.min(speed / WALK_SPEED, RUN_SPEED / WALK_SPEED)
			: 0;
		bobAmount.current +=
			(targetBob - bobAmount.current) * (1 - Math.exp(-8 * delta));
		if (moving) {
			bobPhase.current += speed * delta * BOB_FREQUENCY * Math.PI;
		}
		const runScale = k.shift ? RUN_BOB_SCALE : 1;
		const bobY =
			Math.abs(Math.sin(bobPhase.current)) *
			BOB_HEIGHT *
			bobAmount.current *
			runScale;
		const bobX =
			Math.cos(bobPhase.current) *
			BOB_SWAY *
			bobAmount.current *
			runScale;

		// Body faces where you look
		player.rotation.y = yaw.current;

		// Camera: eye height + bob (sway applied sideways relative to view)
		camera.position.set(
			p.x + cos * bobX,
			p.y + EYE_HEIGHT + bobY,
			p.z - sin * bobX,
		);
		camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
	});

	return (
		<group
			ref={playerRef}
			position={layout.player_spawn.position}
			visible={false}
		>
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
