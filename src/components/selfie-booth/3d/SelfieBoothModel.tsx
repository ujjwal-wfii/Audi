"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { createIdleScreenTexture } from "./IdleScreenTexture";

interface SelfieBoothModelProps {
	onAction: () => void;
	actionLabel: string;
	actionDisabled: boolean;
	cameraTexture?: THREE.Texture | null; // was THREE.VideoTexture | null
}
/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function RoundedPanel({
	position,
	size,
	radius,
	color,
	map,
}: {
	position: [number, number, number];
	size: [number, number, number];
	radius: number;
	color: string;
	map?: THREE.Texture;
}) {
	return (
		<RoundedBox
			position={position}
			args={size}
			radius={radius}
			smoothness={6}
		>
			<meshStandardMaterial color={color} roughness={0.38} map={map} />
		</RoundedBox>
	);
}

/* ---------------------------------------------------------------------- */
/* Camera Screen                                                           */
/* ---------------------------------------------------------------------- */

/*
 * Keep the live image on a flat surface. The extruded bezel has an actual
 * opening, so this plane sits behind its front edge and reads as a recessed
 * display instead of a texture laid over the booth geometry.
 */
function CameraScreen({
	texture,
	dotTexture,
}: {
	texture?: THREE.Texture | null; // was THREE.VideoTexture | null
	dotTexture: THREE.Texture;
}) {
	return (
		<mesh position={[0, 4.05, -0.14]}>
			<planeGeometry args={[5.92, 4.92]} />
			<meshBasicMaterial
				map={texture ?? dotTexture}
				transparent
				toneMapped={false}
				side={THREE.FrontSide}
			/>
		</mesh>
	);
}

function createRoundedFrameShape(
	width: number,
	height: number,
	radius: number,
	clockwise = false,
) {
	const path = clockwise ? new THREE.Path() : new THREE.Shape();
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const r = Math.min(radius, halfWidth, halfHeight);

	if (!clockwise) {
		path.moveTo(-halfWidth + r, -halfHeight);
		path.lineTo(halfWidth - r, -halfHeight);
		path.quadraticCurveTo(
			halfWidth,
			-halfHeight,
			halfWidth,
			-halfHeight + r,
		);
		path.lineTo(halfWidth, halfHeight - r);
		path.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
		path.lineTo(-halfWidth + r, halfHeight);
		path.quadraticCurveTo(
			-halfWidth,
			halfHeight,
			-halfWidth,
			halfHeight - r,
		);
		path.lineTo(-halfWidth, -halfHeight + r);
		path.quadraticCurveTo(
			-halfWidth,
			-halfHeight,
			-halfWidth + r,
			-halfHeight,
		);
	} else {
		path.moveTo(-halfWidth + r, -halfHeight);
		path.quadraticCurveTo(
			-halfWidth,
			-halfHeight,
			-halfWidth,
			-halfHeight + r,
		);
		path.lineTo(-halfWidth, halfHeight - r);
		path.quadraticCurveTo(
			-halfWidth,
			halfHeight,
			-halfWidth + r,
			halfHeight,
		);
		path.lineTo(halfWidth - r, halfHeight);
		path.quadraticCurveTo(halfWidth, halfHeight, halfWidth, halfHeight - r);
		path.lineTo(halfWidth, -halfHeight + r);
		path.quadraticCurveTo(
			halfWidth,
			-halfHeight,
			halfWidth - r,
			-halfHeight,
		);
	}
	path.closePath();
	return path;
}

function createScreenFrameGeometry() {
	const shape = createRoundedFrameShape(6.2, 5.2, 0.42) as THREE.Shape;
	const opening = createRoundedFrameShape(
		5.94,
		4.94,
		0.3,
		true,
	) as THREE.Path;
	shape.holes.push(opening);

	return new THREE.ExtrudeGeometry(shape, {
		depth: 0.22,
		bevelEnabled: true,
		bevelSegments: 3,
		bevelSize: 0.025,
		bevelThickness: 0.02,
		curveSegments: 12,
	});
}

function ScreenBezel() {
	const geometry = useMemo(createScreenFrameGeometry, []);

	useEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh geometry={geometry} position={[0, 4.05, -0.34]}>
			<meshStandardMaterial
				color="#182434"
				roughness={0.24}
				metalness={0.58}
			/>
		</mesh>
	);
}

/* ---------------------------------------------------------------------- */
/* LED Frame                                                               */
/* ---------------------------------------------------------------------- */

function GlowFrame({ glowRef }: { glowRef: RefObject<THREE.Mesh | null> }) {
	const materialProps = {
		color: "#fffdf8",
		emissive: "#fff7df",
		emissiveIntensity: 3.5,
	};

	return (
		<group>
			{/* Top */}
			<RoundedBox
				ref={glowRef}
				position={[0, 6.75, -0.05]}
				args={[6.55, 0.12, 0.1]}
				radius={0.05}
				smoothness={4}
			>
				<meshStandardMaterial {...materialProps} />
			</RoundedBox>

			{/* Left */}
			<RoundedBox
				position={[-3.25, 4.08, -0.05]}
				args={[0.12, 5.35, 0.1]}
				radius={0.05}
				smoothness={4}
			>
				<meshStandardMaterial {...materialProps} />
			</RoundedBox>

			{/* Right */}
			<RoundedBox
				position={[3.25, 4.08, -0.05]}
				args={[0.12, 5.35, 0.1]}
				radius={0.05}
				smoothness={4}
			>
				<meshStandardMaterial {...materialProps} />
			</RoundedBox>

			{/* Bottom */}
			<RoundedBox
				position={[0, 1.41, -0.05]}
				args={[6.55, 0.12, 0.1]}
				radius={0.05}
				smoothness={4}
			>
				<meshStandardMaterial {...materialProps} />
			</RoundedBox>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Side Decorations                                                        */
/* ---------------------------------------------------------------------- */

function IconChip({
	position,
	background,
	glyph,
	color,
}: {
	position: [number, number, number];
	background: string;
	glyph: string;
	color: string;
}) {
	return (
		<group position={position}>
			<RoundedBox args={[0.56, 0.56, 0.12]} radius={0.16} smoothness={5}>
				<meshStandardMaterial color={background} roughness={0.32} />
			</RoundedBox>
			<Text
				position={[0, 0, 0.08]}
				fontSize={0.31}
				anchorX="center"
				anchorY="middle"
				color={color}
			>
				{glyph}
			</Text>
		</group>
	);
}

function SideDecorations({
	position,
	badgeText,
}: {
	position: [number, number, number];
	badgeText: string;
}) {
	return (
		<group position={position}>
			{/* <RoundedBox args={[0.68, 5.0, 0.16]} radius={0.2} smoothness={6}>
				<meshStandardMaterial color="#ffffff" roughness={0.25} />
			</RoundedBox> */}
			<RoundedBox
				position={[0, 2.12, 0.14]}
				args={[1.02, 0.72, 0.12]}
				radius={0.16}
				smoothness={5}
			>
				<meshStandardMaterial color="#123b78" roughness={0.3} />
			</RoundedBox>
			<Text
				position={[0, 2.12, 0.22]}
				fontSize={0.11}
				maxWidth={0.86}
				textAlign="center"
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				{badgeText}
			</Text>
			<IconChip
				position={[0, 1.2, 0.14]}
				background="#fffdf8"
				glyph="♥"
				color="#ef3340"
			/>
			<IconChip
				position={[0, 0.38, 0.14]}
				background="#168cff"
				glyph="✓"
				color="#ffffff"
			/>
			<IconChip
				position={[0, -0.44, 0.14]}
				background="#ffd23f"
				glyph="➤"
				color="#123b78"
			/>
			<IconChip
				position={[0, -1.26, 0.14]}
				background="#fffdf8"
				glyph="#"
				color="#168cff"
			/>
			<IconChip
				position={[0, -2.1, 0.14]}
				background="#fffd38"
				glyph="○"
				color="#168cff"
			/>
		</group>
	);
}
/* ---------------------------------------------------------------------- */
/* Wood Texture                                                            */
/* ---------------------------------------------------------------------- */

function createBoothWoodTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");

	canvas.width = 1024;

	canvas.height = 512;

	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return new THREE.CanvasTexture(canvas);
	}

	/* Warm light oak base */
	ctx.fillStyle = "#c99a68";

	ctx.fillRect(0, 0, canvas.width, canvas.height);

	/*
	 * Horizontal wood grain.
	 */
	for (let y = 0; y < canvas.height; y += 18) {
		const variation = Math.sin(y * 0.045) * 8;

		ctx.strokeStyle = `rgba(92, 55, 28, ${0.1 + Math.random() * 0.06})`;

		ctx.lineWidth = 2;

		ctx.beginPath();

		ctx.moveTo(0, y);

		for (let x = 0; x <= canvas.width; x += 80) {
			const wave =
				Math.sin(x * 0.012 + y * 0.018) * (3 + Math.random() * 3);

			ctx.lineTo(x, y + wave + variation);
		}

		ctx.stroke();
	}

	/* Very subtle lighter grain */
	for (let i = 0; i < 90; i++) {
		const y = Math.random() * canvas.height;

		ctx.strokeStyle = "rgba(255,255,255,0.06)";

		ctx.lineWidth = 1;

		ctx.beginPath();

		ctx.moveTo(0, y);

		for (let x = 0; x <= canvas.width; x += 100) {
			ctx.lineTo(x, y + Math.sin(x * 0.015 + i) * 3);
		}

		ctx.stroke();
	}

	const texture = new THREE.CanvasTexture(canvas);

	texture.wrapS = THREE.RepeatWrapping;

	texture.wrapT = THREE.RepeatWrapping;

	texture.repeat.set(1.4, 1);

	texture.colorSpace = THREE.SRGBColorSpace;

	texture.needsUpdate = true;

	return texture;
}

function BoothActionButton({
	label,
	onClick,
	disabled,
}: {
	label: string;
	onClick: () => void;
	disabled: boolean;
}) {
	const [hovered, setHovered] = useState(false);

	return (
		<group
			position={[0, 0.95, 0.04]}
			onClick={(event) => {
				event.stopPropagation();
				if (!disabled) onClick();
			}}
			onPointerOver={(event) => {
				event.stopPropagation();
				if (!disabled) {
					setHovered(true);
					document.body.style.cursor = "pointer";
				}
			}}
			onPointerOut={() => {
				setHovered(false);
				document.body.style.cursor = "auto";
			}}
		>
			<RoundedBox args={[2.6, 0.54, 0.16]} radius={0.16} smoothness={6}>
				<meshStandardMaterial
					color={
						disabled ? "#9aa8b8" : hovered ? "#1b55a0" : "#123b78"
					}
					roughness={0.28}
					metalness={0.08}
				/>
			</RoundedBox>
			<Text
				position={[0, 0, 0.09]}
				fontSize={0.19}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				{label}
			</Text>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Counter Shape                                                           */
/* ---------------------------------------------------------------------- */

function createRoundedCounterShape(
	width: number,
	depth: number,
	radius: number,
) {
	const shape = new THREE.Shape();

	const halfWidth = width / 2;

	const halfDepth = depth / 2;

	/* Back edge */
	shape.moveTo(-halfWidth + radius, -halfDepth);

	shape.lineTo(halfWidth - radius, -halfDepth);

	/* Back-right corner */
	shape.quadraticCurveTo(
		halfWidth,
		-halfDepth,
		halfWidth,
		-halfDepth + radius,
	);

	/* Right side */
	shape.lineTo(halfWidth, halfDepth - radius);

	/* Front-right rounded corner */
	shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);

	/* Front edge */
	shape.lineTo(-halfWidth + radius, halfDepth);

	/* Front-left rounded corner */
	shape.quadraticCurveTo(
		-halfWidth,
		halfDepth,
		-halfWidth,
		halfDepth - radius,
	);

	/* Left side */
	shape.lineTo(-halfWidth, -halfDepth + radius);

	/* Back-left corner */
	shape.quadraticCurveTo(
		-halfWidth,
		-halfDepth,
		-halfWidth + radius,
		-halfDepth,
	);

	shape.closePath();

	return shape;
}

/* ---------------------------------------------------------------------- */
/* Counter                                                                 */
/* ---------------------------------------------------------------------- */

function Counter() {
	const woodTexture = useMemo(() => {
		return createBoothWoodTexture();
	}, []);

	useEffect(() => {
		return () => {
			woodTexture.dispose();
		};
	}, [woodTexture]);

	return (
		<group position={[0, 0.62, 0.45]}>
			{/* ======================================================== */}
			{/* MAIN CURVED WOOD COUNTERTOP                              */}
			{/* ======================================================== */}

			<mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<extrudeGeometry
					args={[
						createRoundedCounterShape(9.8, 2.15, 0.38),
						{
							depth: 0.42,
							bevelEnabled: true,
							bevelSegments: 5,
							bevelSize: 0.06,
							bevelThickness: 0.05,
							curveSegments: 8,
						},
					]}
				/>

				<meshStandardMaterial
					map={woodTexture}
					color="#d2a06c"
					roughness={0.48}
					metalness={0}
				/>
			</mesh>

			{/* ======================================================== */}
			{/* FRONT WOODEN APRON                                       */}
			{/* ======================================================== */}

			<mesh position={[0, -0.18, 1.56]}>
				<boxGeometry args={[9.35, 0.38, 0.16]} />

				<meshStandardMaterial
					map={woodTexture}
					color="#b98250"
					roughness={0.5}
				/>
			</mesh>

			{/* ======================================================== */}
			{/* BLUE FRONT SOCIAL PANEL                                   */}
			{/* ======================================================== */}

			<RoundedBox
				position={[0, -0.55, 1.62]}
				args={[9.5, 0.48, 0.18]}
				radius={0.08}
				smoothness={6}
			>
				<meshStandardMaterial
					color="#123b78"
					roughness={0.3}
					metalness={0.12}
				/>
			</RoundedBox>

			{/* ======================================================== */}
			{/* CYAN LIGHT UNDER BLUE PANEL                               */}
			{/* ======================================================== */}

			<mesh position={[0, -0.82, 1.66]}>
				<boxGeometry args={[9.5, 0.045, 0.035]} />

				<meshStandardMaterial
					color="#8ddfff"
					emissive="#42c8ff"
					emissiveIntensity={2.5}
				/>
			</mesh>

			<Text
				position={[-3.35, -0.55, 1.74]}
				fontSize={0.24}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				♥ ○ ➤
			</Text>

			{/* ======================================================== */}
			{/* CENTER HASHTAG                                            */}
			{/* ======================================================== */}

			<Text
				position={[0, -0.55, 1.74]}
				fontSize={0.28}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				#FutureTogether
			</Text>

			<Text
				position={[3.35, -0.55, 1.74]}
				fontSize={0.22}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				▤
			</Text>

			{/* ======================================================== */}
			{/* RIGHT BOOKMARK                                             */}
			{/* ======================================================== */}

			<Text
				position={[3.35, -0.55, 1.74]}
				fontSize={0.22}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				▤
			</Text>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Main Component                                                          */
/* ---------------------------------------------------------------------- */

export default function SelfieBoothModel({
	onAction,
	actionLabel,
	actionDisabled,
	cameraTexture,
}: SelfieBoothModelProps) {
	const glowRef = useRef<THREE.Mesh>(null);
	const [loadedIdleTexture, setLoadedIdleTexture] =
		useState<THREE.Texture | null>(null);

	/* ------------------------------------------------------------------ */
	/* LED animation                                                       */
	/* ------------------------------------------------------------------ */

	useFrame(({ clock }) => {
		if (!glowRef.current) {
			return;
		}

		const material = glowRef.current.material as THREE.MeshStandardMaterial;

		material.emissiveIntensity =
			3.2 + Math.sin(clock.elapsedTime * 2) * 0.35;
	});

	/* ------------------------------------------------------------------ */
	/* Idle screen texture                                                 */
	/* ------------------------------------------------------------------ */

	const fallbackIdleTexture = useMemo(() => {
		if (typeof document === "undefined") {
			return undefined;
		}

		return createIdleScreenTexture();
	}, []);

	useEffect(() => {
		let cancelled = false;
		const textureLoader = new THREE.TextureLoader();
		const imageTexture = textureLoader.load(
			"/selfie-booth/backgroundImage.png",
			(loaded) => {
				if (cancelled) {
					loaded.dispose();
					return;
				}
				const screenAspect = 5.92 / 4.92;
				const imageAspect = loaded.image.width / loaded.image.height;
				if (imageAspect > screenAspect) {
					loaded.repeat.set(screenAspect / imageAspect, 1);
					loaded.offset.x = (1 - loaded.repeat.x) / 2;
				} else {
					loaded.repeat.set(1, imageAspect / screenAspect);
					loaded.offset.y = (1 - loaded.repeat.y) / 2;
				}
				loaded.wrapS = THREE.ClampToEdgeWrapping;
				loaded.wrapT = THREE.ClampToEdgeWrapping;
				loaded.colorSpace = THREE.SRGBColorSpace;
				loaded.minFilter = THREE.LinearFilter;
				loaded.magFilter = THREE.LinearFilter;
				loaded.generateMipmaps = false;
				setLoadedIdleTexture(loaded);
			},
			undefined,
			() => {
				// Keep the generated idle screen until the branded image is added.
			},
		);

		return () => {
			cancelled = true;
			if (imageTexture.image) imageTexture.dispose();
			fallbackIdleTexture?.dispose();
		};
	}, [fallbackIdleTexture]);

	/* ------------------------------------------------------------------ */
	/* Render                                                              */
	/* ------------------------------------------------------------------ */

	return (
		<group>
			{/* ============================================================ */}
			{/* MAIN BOOTH BODY                                               */}
			{/* ============================================================ */}

			<RoundedPanel
				position={[0, 3.5, -0.8]}
				size={[9.9, 9.25, 0.65]}
				radius={0.45}
				color="#fbfaf8"
			/>

			{/* ============================================================ */}
			{/* HEADER                                                        */}
			{/* ============================================================ */}

			<RoundedPanel
				position={[0, 7.35, -0.58]}
				size={[8.25, 1.15, 0.22]}
				radius={0.16}
				color="#ffffff"
			/>

			<Text
				position={[0, 7.48, -0.38]}
				fontSize={0.68}
				anchorX="center"
				anchorY="middle"
				color="#123b78"
			>
				OPEXN
			</Text>

			<Text
				position={[0, 7.08, -0.38]}
				fontSize={0.11}
				letterSpacing={0.16}
				anchorX="center"
				anchorY="middle"
				color="#506070"
			>
				CONNECT • LEARN • INNOVATE
			</Text>

			{/* ============================================================ */}
			{/* CENTRAL SELFIE SCREEN                                         */}
			{/* ============================================================ */}

			{/* Recessed screen backing and a genuinely hollow raised bezel */}
			<RoundedPanel
				position={[0, 4.05, -0.24]}
				size={[5.94, 4.94, 0.06]}
				radius={0.3}
				color="#101a2a"
			/>
			<ScreenBezel />

			{/* Actual camera display */}
			<CameraScreen
				texture={cameraTexture}
				dotTexture={
					loadedIdleTexture ??
					fallbackIdleTexture ??
					new THREE.Texture()
				}
			/>

			<BoothActionButton
				label={actionLabel}
				onClick={onAction}
				disabled={actionDisabled}
			/>

			{/* ============================================================ */}
			{/* LED FRAME                                                     */}
			{/* ============================================================ */}

			<GlowFrame glowRef={glowRef} />

			{/* ============================================================ */}
			{/* SIDE DECORATIONS                                              */}
			{/* ============================================================ */}

			<SideDecorations
				position={[-3.92, 4.05, -0.12]}
				badgeText="GOOD VIBES ONLY"
			/>

			<SideDecorations
				position={[3.92, 4.05, -0.12]}
				badgeText="CAPTURE SHARE INSPIRE"
			/>

			{/* ============================================================ */}
			{/* COUNTER                                                       */}
			{/* ============================================================ */}

			<Counter />
		</group>
	);
}
