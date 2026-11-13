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
import StallProximityTracker from "../stalls/StallProximityTracker";
import { interactionStore } from "@/lib/expo/stall-interactivity/interactionStore";

const layout = hallLayoutJson as unknown as HallLayout;
const HALL_WALL_TEXTURE_URL =
	"/textures/walls/Geometric Exhibition Hall Wall.png";
// "/textures/walls/front end wall3.jpeg";
const MAIN_EXIT_WIDTH = 8;
const MAIN_EXIT_HEIGHT = 4.5;

function createEndWallMaterial(
	texture: THREE.Texture,
	repeatX: number,
	repeatY: number,
	offsetX = 0,
) {
	const wallTexture = texture.clone();
	wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
	wallTexture.repeat.set(repeatX, repeatY);
	wallTexture.offset.x = offsetX;
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

const PATTERN_IMAGE_HEIGHT_M = 10; // metres of wall one full image height represents (smaller = finer panels)
const WALL_SURFACE_OFFSET = 0.01; // pushes walls just outside the hall bounds to avoid z-fighting
// Zone boundaries as fractions of the image height (rows measured on your 887 px image)
const BASE_FRAC = 32 / 887; // dark baseboard, bottom
const BAND_FRAC = 320 / 887; // spotlight zone, top
const FIELD_FRAC = 1 - BASE_FRAC - BAND_FRAC; // repeating panel area

type Zone = {
	vMin: number; // image v range (0 = bottom of image, 1 = top)
	vMax: number;
	y0: number; // wall height range in metres
	y1: number;
	tileH: number; // metres of wall per image tile in this zone
};

// Pure helper: splits [a,b] at every multiple of `size` counted from `base`.
function breakpoints(a: number, b: number, base: number, size: number) {
	const out = [a];
	for (
		let k = Math.floor((a - base) / size) + 1;
		base + k * size < b - 1e-6;
		k++
	) {
		out.push(base + k * size);
	}
	out.push(b);
	return out;
}

// Pure helper: 0..1 position inside tile `index`, flipped on odd tiles (mirrored repeat).
function mirrored(value: number, base: number, size: number, index: number) {
	const frac = (value - base - index * size) / size;
	return index % 2 === 0 ? frac : 1 - frac;
}

// Builds a flat, camera-facing mesh for the rectangle [s0,s1] x [y0,y1] of one zone.
// Each tile cell is its own quad, so mirrored tiles need no texture wrap modes.
function buildZoneGeometry(
	s0: number,
	s1: number,
	y0: number,
	y1: number,
	zone: Zone,
	sBase: number,
	tileW: number,
) {
	const xs = breakpoints(s0, s1, sBase, tileW);
	const ys = breakpoints(y0, y1, zone.y0, zone.tileH);
	const positions: number[] = [];
	const uvs: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];

	for (let i = 0; i < xs.length - 1; i++) {
		const ti = Math.floor(((xs[i] + xs[i + 1]) / 2 - sBase) / tileW);
		for (let j = 0; j < ys.length - 1; j++) {
			const tj = Math.floor(
				((ys[j] + ys[j + 1]) / 2 - zone.y0) / zone.tileH,
			);
			const base = positions.length / 3;
			const corners = [
				[xs[i], ys[j]],
				[xs[i + 1], ys[j]],
				[xs[i + 1], ys[j + 1]],
				[xs[i], ys[j + 1]],
			];
			for (const [x, y] of corners) {
				positions.push(x, y, 0);
				normals.push(0, 0, 1);
				uvs.push(
					mirrored(x, sBase, tileW, ti),
					zone.vMin +
						mirrored(y, zone.y0, zone.tileH, tj) *
							(zone.vMax - zone.vMin),
				);
			}
			indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);
	geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	geo.setIndex(indices);
	return geo;
}

function useWallMaterial(url: string) {
	const texture = useTexture(url);
	const { gl } = useThree();

	return useMemo(() => {
		const map = texture.clone();
		map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; // mirroring is done in the geometry UVs
		map.colorSpace = THREE.SRGBColorSpace;
		map.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
		map.needsUpdate = true;
		const image = texture.image as
			| { width: number; height: number }
			| undefined;
		const aspect = image ? image.width / image.height : 2;
		return {
			material: new THREE.MeshStandardMaterial({ map, roughness: 0.8 }),
			aspect,
		};
	}, [texture, gl]);
}

type WallProps = {
	origin: [number, number, number];
	rotationY: number; // planes face +z by default; this turns them into the hall
	length: number;
	zones: Zone[];
	tileW: number;
	material: THREE.Material;
	door?: { halfWidth: number; height: number };
};

function Wall({
	origin,
	rotationY,
	length,
	zones,
	tileW,
	material,
	door,
}: WallProps) {
	const half = length / 2;
	const geometries = useMemo(() => {
		// rectangles of the wall: [s0, s1, minY]
		const rects: [number, number, number][] = door
			? [
					[-half, -door.halfWidth, 0],
					[door.halfWidth, half, 0],
					[-door.halfWidth, door.halfWidth, door.height], // lintel above the opening
				]
			: [[-half, half, 0]];
		const out: THREE.BufferGeometry[] = [];
		for (const [s0, s1, minY] of rects) {
			for (const zone of zones) {
				const y0 = Math.max(zone.y0, minY);
				if (y0 >= zone.y1 - 1e-6) continue;
				out.push(
					buildZoneGeometry(s0, s1, y0, zone.y1, zone, -half, tileW),
				);
			}
		}
		return out;
	}, [door, half, zones, tileW]);

	return (
		<group position={origin} rotation={[0, rotationY, 0]}>
			{geometries.map((geometry, i) => (
				<mesh key={i} geometry={geometry} material={material} />
			))}
		</group>
	);
}

function HallWalls() {
	const { min, max } = layout.hall;
	const wallHeight = layout.hall.ceiling_height;
	const width = max.x - min.x;
	const depth = max.z - min.z;
	const centerZ = (min.z + max.z) / 2;
	const { material, aspect } = useWallMaterial(HALL_WALL_TEXTURE_URL);

	// Choose a whole number of panel-field tiles so the zones add up to exactly the wall height.
	const { zones, tileW } = useMemo(() => {
		const fieldTiles = Math.max(
			1,
			Math.round(
				(wallHeight / PATTERN_IMAGE_HEIGHT_M - BASE_FRAC - BAND_FRAC) /
					FIELD_FRAC,
			),
		);
		const imageH =
			wallHeight / (BASE_FRAC + BAND_FRAC + fieldTiles * FIELD_FRAC);
		const baseH = BASE_FRAC * imageH;
		const fieldTileH = FIELD_FRAC * imageH;
		const fieldH = fieldTiles * fieldTileH;
		const bandH = BAND_FRAC * imageH;
		const zones: Zone[] = [
			{ vMin: 0, vMax: BASE_FRAC, y0: 0, y1: baseH, tileH: baseH },
			{
				vMin: BASE_FRAC,
				vMax: BASE_FRAC + FIELD_FRAC,
				y0: baseH,
				y1: baseH + fieldH,
				tileH: fieldTileH,
			},
			{
				vMin: BASE_FRAC + FIELD_FRAC,
				vMax: 1,
				y0: baseH + fieldH,
				y1: wallHeight,
				tileH: bandH,
			},
		];
		return { zones, tileW: imageH * aspect };
	}, [wallHeight, aspect]);

	const common = { zones, tileW, material };

	return (
		<group>
			{/* rear wall, faces +z */}
			<Wall
				{...common}
				origin={[0, 0, min.z - WALL_SURFACE_OFFSET]}
				rotationY={0}
				length={width}
			/>
			{/* front wall, faces -z, with the main exit opening */}
			<Wall
				{...common}
				origin={[0, 0, max.z + WALL_SURFACE_OFFSET]}
				rotationY={Math.PI}
				length={width}
				door={{
					halfWidth: MAIN_EXIT_WIDTH / 2,
					height: MAIN_EXIT_HEIGHT,
				}}
			/>
			{/* left wall, faces +x */}
			<Wall
				{...common}
				origin={[min.x - WALL_SURFACE_OFFSET, 0, centerZ]}
				rotationY={Math.PI / 2}
				length={depth}
			/>
			{/* right wall, faces -x */}
			<Wall
				{...common}
				origin={[max.x + WALL_SURFACE_OFFSET, 0, centerZ]}
				rotationY={-Math.PI / 2}
				length={depth}
			/>
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
		if (interactionStore.getState().panelOpen) return;
		let lookEnabled = false;
		let lookPointerId: number | null = null;
		let lastX = 0;
		let lastY = 0;

		const toggleLook = () => {
			lookEnabled = !lookEnabled;
		};
		const onPointerDown = (event: PointerEvent) => {
			if (
				!lookEnabled ||
				event.pointerType !== "mouse" ||
				event.button !== 0
			) {
				return;
			}
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

		canvas.addEventListener("dblclick", toggleLook);
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerup", stopLooking);
		canvas.addEventListener("pointercancel", stopLooking);
		return () => {
			canvas.removeEventListener("dblclick", toggleLook);
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", stopLooking);
			canvas.removeEventListener("pointercancel", stopLooking);
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
		// const k = keys.current;
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
			<StallProximityTracker
				stalls={layout.stalls}
				frontOf={(s) =>
					explicitStallFrontDirections[s.id] === "negative-z" ? -1 : 1
				}
				debug
			/>

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
