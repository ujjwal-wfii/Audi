"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import hallLayoutJson from "@/lib/expo/layout/hall-layout.json";
import type {
	HallLayout,
	Stall,
	HallPath,
	StallType,
} from "@/lib/expo/layout/schema";
// import Ceiling from "./Ceiling";
import LargeStall from "../stalls/LargeStall";
import MediumStall from "../stalls/MediumStall";
import SmallStall from "../stalls/SmallStall";
import SpecialStall from "../stalls/SpecialStall";
import type { StallVisualProps } from "../stalls/stallTypes";
import Ceiling from "./Ceiling";

const layout: HallLayout = hallLayoutJson;
const HALL_WALL_TEXTURE_URL =
	"/textures/walls/Geometric Exhibition Hall Wall.png";
const HALL_END_WALL_TEXTURE_URL =
	"/textures/walls/front end wall.jpeg";
const END_WALL_TILE_COUNT = 2;
const MAIN_EXIT_WIDTH = 8;
const MAIN_EXIT_HEIGHT = 4.5;

function createEndWallMaterial(texture: THREE.Texture, repeatX: number) {
	const wallTexture = texture.clone();
	wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
	wallTexture.repeat.set(
		repeatX * END_WALL_TILE_COUNT,
		END_WALL_TILE_COUNT,
	);
	wallTexture.colorSpace = THREE.SRGBColorSpace;
	wallTexture.anisotropy = 16;
	wallTexture.needsUpdate = true;
	return new THREE.MeshStandardMaterial({
		map: wallTexture,
		roughness: 0.8,
	});
}

const stallColors: Record<StallType, string> = {
	small: "#2F7F7B",
	medium: "#C88A3D",
	large: "#7564A8",
	special: "#C56A72",
};

const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 2.9;
const RUN_SPEED = 4.4;
const EYE_HEIGHT = 2;
const MOUSE_SENSITIVITY = 0.0022;
// Keep the first-person view within 30 degrees above and below the horizon.
const MAX_PITCH = THREE.MathUtils.degToRad(15);
// const MOVEMENT_TURN_SPEED = 2.4;
// const MAX_MOVEMENT_TURN_RATE = 2.2;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
type StallFrontDirection = "positive-z" | "negative-z";

const explicitStallFrontDirections: Record<string, StallFrontDirection> = {
	S11: "negative-z",
	S12: "negative-z",
	S13: "negative-z",
	S14: "negative-z",
	S15: "negative-z",
	S16: "negative-z",
	S17: "negative-z",
	S18: "negative-z",
	S19: "negative-z",
	S20: "negative-z",
	SP3: "negative-z",
	SP4: "negative-z",
	L3: "negative-z",
	L4: "negative-z",
	M11: "negative-z",
	M12: "negative-z",
	M13: "negative-z",
	M14: "negative-z",
};

function circleHitsRect(x: number, z: number, radius: number, rect: Rect) {
	const nearestX = THREE.MathUtils.clamp(x, rect.minX, rect.maxX);
	const nearestZ = THREE.MathUtils.clamp(z, rect.minZ, rect.maxZ);
	return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2;
}

function StallBlock({ stall }: { stall: Stall }) {
	const [width, height, depth] = layout.stall_sizes[stall.type];
	const [x, , z] = stall.center;
	const frontDirection = explicitStallFrontDirections[stall.id];
	const rotationY = frontDirection === "negative-z" ? Math.PI : 0;
	const props: StallVisualProps = {
		stall,
		rotationY,
		size: [width, height, depth],
		color: stallColors[stall.type],
	};
	const StallComponent = {
		small: SmallStall,
		medium: MediumStall,
		large: LargeStall,
		special: SpecialStall,
	}[stall.type];

	return (
		<group position={[x, 0, z]}>
			<StallComponent {...props} />
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
	const texture = useTexture(HALL_WALL_TEXTURE_URL);
	const endWallTexture = useTexture(HALL_END_WALL_TEXTURE_URL);
	const wallMaterial = useMemo(() => {
		const wallTexture = texture.clone();
		wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
		wallTexture.repeat.set(4, 2);
		wallTexture.colorSpace = THREE.SRGBColorSpace;
		wallTexture.anisotropy = 16;
		wallTexture.needsUpdate = true;
		return new THREE.MeshStandardMaterial({
			map: wallTexture,
			roughness: 0.8,
		});
	}, [texture]);
	const endWallMaterials = useMemo(
		() => [
			createEndWallMaterial(endWallTexture, width / wallHeight),
			createEndWallMaterial(
				endWallTexture,
				Math.abs(min.x + MAIN_EXIT_WIDTH / 2) / wallHeight,
			),
			createEndWallMaterial(
				endWallTexture,
				Math.abs(max.x - MAIN_EXIT_WIDTH / 2) / wallHeight,
			),
			createEndWallMaterial(
				endWallTexture,
				MAIN_EXIT_WIDTH / (wallHeight - MAIN_EXIT_HEIGHT),
			),
		],
		[endWallTexture, max.x, min.x, wallHeight, width],
	);

	const sideSegments = useMemo(() => {
		return [min.x, max.x].map((x) => ({
			x,
			z: (min.z + max.z) / 2,
			width: thickness,
			depth: max.z - min.z,
		}));
	}, [min.x, max.x, min.z, max.z]);

	return (
		<group>
			<mesh position={[0, wallHeight / 2, min.z]}>
				<boxGeometry args={[width, wallHeight, thickness]} />
				<primitive object={endWallMaterials[0]} attach="material" />
			</mesh>
			<mesh
				position={[
					(min.x - MAIN_EXIT_WIDTH / 2) / 2,
					wallHeight / 2,
					max.z,
				]}
			>
				<boxGeometry
					args={[
						Math.abs(min.x + MAIN_EXIT_WIDTH / 2),
						wallHeight,
						thickness,
					]}
				/>
				<primitive object={endWallMaterials[1]} attach="material" />
			</mesh>
			<mesh
				position={[
					(max.x + MAIN_EXIT_WIDTH / 2) / 2,
					wallHeight / 2,
					max.z,
				]}
			>
				<boxGeometry
					args={[
						Math.abs(max.x - MAIN_EXIT_WIDTH / 2),
						wallHeight,
						thickness,
					]}
				/>
				<primitive object={endWallMaterials[2]} attach="material" />
			</mesh>
			<mesh
				position={[
					0,
					MAIN_EXIT_HEIGHT +
						(wallHeight - MAIN_EXIT_HEIGHT) / 2,
					max.z,
				]}
			>
				<boxGeometry
					args={[
						MAIN_EXIT_WIDTH,
						wallHeight - MAIN_EXIT_HEIGHT,
						thickness,
					]}
				/>
				<primitive object={endWallMaterials[3]} attach="material" />
			</mesh>
			{sideSegments.map((segment, i) => (
				<mesh key={i} position={[segment.x, wallHeight / 2, segment.z]}>
					<boxGeometry
						args={[segment.width, wallHeight, segment.depth]}
					/>
					<primitive object={wallMaterial} attach="material" />
				</mesh>
			))}
		</group>
	);
}

const HALL_FLOOR_TEXTURE_URL = "/textures/floor/floral_jacquard_diff_1k.jpg";
const HALL_FLOOR_TILE_SIZE = 4;

function HallFloorTexture({
	floorSize,
	floorCenter,
}: {
	floorSize: number[];
	floorCenter: number[];
}) {
	const texture = useTexture(HALL_FLOOR_TEXTURE_URL);
	const tiledTexture = useMemo(() => {
		const clonedTexture = texture.clone();
		clonedTexture.wrapS = clonedTexture.wrapT = THREE.RepeatWrapping;
		clonedTexture.repeat.set(
			floorSize[0] / HALL_FLOOR_TILE_SIZE,
			floorSize[2] / HALL_FLOOR_TILE_SIZE,
		);
		clonedTexture.colorSpace = THREE.SRGBColorSpace;
		clonedTexture.anisotropy = 16;
		clonedTexture.needsUpdate = true;
		return clonedTexture;
	}, [floorSize, texture]);

	return (
		<mesh
			position={[floorCenter[0], 0.002, floorCenter[2]]}
			rotation={[-Math.PI / 2, 0, 0]}
			raycast={() => null}
		>
			<planeGeometry args={[floorSize[0], floorSize[2]]} />
			<meshStandardMaterial map={tiledTexture} roughness={0.92} />
		</mesh>
	);
}

const ACCELERATION = 10; // higher = snappier start/stop
const TURN_SPEED = 1.8; // rad/s for arrow-key turning

function PlayerController() {
	const playerRef = useRef<THREE.Group>(null);
	const keys = useRef<Record<string, boolean>>({});
	const yaw = useRef(0);
	const pitch = useRef(-0.08);
	const velocity = useRef(new THREE.Vector2(0, 0)); // x, z in world space
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

	// Touch controls dispatch the same movement inputs as the keyboard controls.
	useEffect(() => {
		const onMobileControl = (event: Event) => {
			const { key, pressed } = (
				event as CustomEvent<{ key?: string; pressed?: boolean }>
			).detail;
			if (!key) return;
			keys.current[key] = Boolean(pressed);
		};

		window.addEventListener("hall-mobile-control", onMobileControl);
		return () =>
			window.removeEventListener("hall-mobile-control", onMobileControl);
	}, []);

	// Touch-dragging the canvas rotates the first-person camera.
	useEffect(() => {
		const canvas = gl.domElement;
		let lookPointerId: number | null = null;
		let lastX = 0;
		let lastY = 0;

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType !== "touch") return;
			lookPointerId = event.pointerId;
			lastX = event.clientX;
			lastY = event.clientY;
			canvas.setPointerCapture(event.pointerId);
		};
		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerId !== lookPointerId) return;
			const mx = THREE.MathUtils.clamp(event.clientX - lastX, -100, 100);
			const my = THREE.MathUtils.clamp(event.clientY - lastY, -100, 100);
			lastX = event.clientX;
			lastY = event.clientY;
			yaw.current -= mx * MOUSE_SENSITIVITY;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - my * MOUSE_SENSITIVITY,
				-MAX_PITCH,
				MAX_PITCH,
			);
		};
		const stopLooking = (event: PointerEvent) => {
			if (event.pointerId !== lookPointerId) return;
			lookPointerId = null;
			if (canvas.hasPointerCapture(event.pointerId)) {
				canvas.releasePointerCapture(event.pointerId);
			}
		};

		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerup", stopLooking);
		canvas.addEventListener("pointercancel", stopLooking);
		return () => {
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", stopLooking);
			canvas.removeEventListener("pointercancel", stopLooking);
		};
	}, [gl]);

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

		// Input relative to where you are looking.
		// Positive values move forward; negative values move backward.
		let forward =
			Number(Boolean(k.w || k.arrowup)) -
			Number(Boolean(k.s || k.arrowdown));
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

		// Body faces where you look
		player.rotation.y = yaw.current;

		camera.position.set(p.x, p.y + EYE_HEIGHT, p.z);
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
			<HallFloorTexture floorSize={floorSize} floorCenter={floorCenter} />

			{layout.paths.map((path) => (
				<PathRegion key={path.id} path={path} />
			))}
			{layout.stalls.map((stall) => (
				<StallBlock key={stall.id} stall={stall} />
			))}
			<HallWalls />
			<Ceiling hall={hallLayoutJson.hall} />
			<PlayerController />
		</>
	);
}
