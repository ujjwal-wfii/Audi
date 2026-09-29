"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { createIdleScreenTexture } from "./IdleScreenTexture";

interface SelfieBoothModelProps {
	onTakeSelfie: () => void;
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
 * This is intentionally a FLAT front-facing surface.
 *
 * The surrounding bezel remains a real 3D RoundedBox.
 *
 * This prevents the VideoTexture from being mapped onto
 * the multiple faces of a RoundedBox.
 */
function CameraScreen({
	texture,
	dotTexture,
}: {
	texture?: THREE.Texture | null; // was THREE.VideoTexture | null
	dotTexture: THREE.Texture;
}) {
	const geometry = useMemo(() => {
		const width = 5.92;
		const height = 4.92;

		return new THREE.PlaneGeometry(width, height);
	}, []);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	return (
		<RoundedBox
			position={[0, 4.05, -0.14]}
			args={[5.89, 4.9, 0.1]}
			radius={0.25}
			smoothness={8}
			scale={[-1, 1, 1]}
		>
			<meshBasicMaterial
				map={texture ?? dotTexture}
				toneMapped={false}
				side={THREE.FrontSide}
			/>
		</RoundedBox>
	);
}

/* ---------------------------------------------------------------------- */
/* Icon Chip                                                               */
/* ---------------------------------------------------------------------- */

function IconChip({
	position,
	bg,
	glyph,
	glyphColor,
	size = 0.58,
}: {
	position: [number, number, number];
	bg: string;
	glyph: string;
	glyphColor: string;
	size?: number;
}) {
	return (
		<group position={position}>
			<RoundedBox
				args={[size, size, 0.12]}
				radius={size * 0.3}
				smoothness={4}
			>
				<meshStandardMaterial color={bg} roughness={0.35} />
			</RoundedBox>

			<Text
				position={[0, 0, 0.09]}
				fontSize={size * 0.55}
				anchorX="center"
				anchorY="middle"
				color={glyphColor}
			>
				{glyph}
			</Text>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Speech Badge                                                            */
/* ---------------------------------------------------------------------- */

function SpeechBadge({
	position,
	lines,
}: {
	position: [number, number, number];
	lines: string;
}) {
	return (
		<group position={position}>
			<RoundedBox args={[1.05, 0.72, 0.1]} radius={0.15} smoothness={4}>
				<meshStandardMaterial color="#123b78" roughness={0.3} />
			</RoundedBox>

			{/* Bubble tail */}
			<mesh position={[0, -0.4, 0]} rotation={[0, 0, Math.PI / 4]}>
				<boxGeometry args={[0.16, 0.16, 0.08]} />

				<meshStandardMaterial color="#123b78" roughness={0.3} />
			</mesh>

			<Text
				position={[0, 0, 0.08]}
				fontSize={0.115}
				maxWidth={0.85}
				textAlign="center"
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
				letterSpacing={0.02}
				lineHeight={1.15}
			>
				{lines}
			</Text>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Open Camera Button                                                      */
/* ---------------------------------------------------------------------- */

function OpenCameraButton({
	position,
}: {
	position: [number, number, number];
}) {
	return (
		<group position={position}>
			<RoundedBox args={[0.95, 0.85, 0.12]} radius={0.16} smoothness={4}>
				<meshStandardMaterial color="#ffffff" roughness={0.3} />
			</RoundedBox>

			{/* Camera glyph */}
			<mesh position={[0, 0.18, 0.08]}>
				<ringGeometry args={[0.1, 0.14, 32]} />

				<meshStandardMaterial color="#123b78" />
			</mesh>

			<mesh position={[0, 0.18, 0.075]}>
				<circleGeometry args={[0.07, 32]} />

				<meshStandardMaterial color="#123b78" />
			</mesh>

			<Text
				position={[0, -0.22, 0.08]}
				fontSize={0.1}
				anchorX="center"
				anchorY="middle"
				color="#123b78"
				letterSpacing={0.02}
			>
				OPEN CAMERA
			</Text>
		</group>
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
			<mesh ref={glowRef} position={[0, 6.75, -0.05]}>
				<boxGeometry args={[6.55, 0.12, 0.1]} />

				<meshStandardMaterial {...materialProps} />
			</mesh>

			{/* Left */}
			<mesh position={[-3.25, 4.08, -0.05]}>
				<boxGeometry args={[0.12, 5.35, 0.1]} />

				<meshStandardMaterial {...materialProps} />
			</mesh>

			{/* Right */}
			<mesh position={[3.25, 4.08, -0.05]}>
				<boxGeometry args={[0.12, 5.35, 0.1]} />

				<meshStandardMaterial {...materialProps} />
			</mesh>

			{/* Bottom */}
			<mesh position={[0, 1.41, -0.05]}>
				<boxGeometry args={[6.55, 0.12, 0.1]} />

				<meshStandardMaterial {...materialProps} />
			</mesh>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Side Decorations                                                        */
/* ---------------------------------------------------------------------- */

function SideDecorations({
	position,
	badgeText,
	emojiGlyph,
	thirdGlyph,
}: {
	position: [number, number, number];
	badgeText: string;
	emojiGlyph: string;
	thirdGlyph: string;
}) {
	return (
		<group position={position}>
			{/* Slim white backing */}
			<RoundedBox args={[0.68, 5.0, 0.16]} radius={0.2} smoothness={6}>
				<meshStandardMaterial color="#ffffff" roughness={0.25} />
			</RoundedBox>

			<SpeechBadge position={[0, 2.22, 0.14]} lines={badgeText} />

			<IconChip
				position={[0, 1.28, 0.14]}
				bg="#ffffff"
				glyph="♥"
				glyphColor="#ef3340"
			/>

			<IconChip
				position={[0, 0.53, 0.14]}
				bg="#168cff"
				glyph="✓"
				glyphColor="#ffffff"
			/>

			<IconChip
				position={[0, -0.22, 0.14]}
				bg="#ffd23f"
				glyph={emojiGlyph}
				glyphColor="#123b78"
			/>

			<IconChip
				position={[0, -0.97, 0.14]}
				bg="#ffffff"
				glyph={thirdGlyph}
				glyphColor="#168cff"
			/>

			<OpenCameraButton position={[0, -2.0, 0.14]} />
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
			{/* DARK LOWER SHADOW / EDGE                                  */}
			{/* ======================================================== */}

			<mesh position={[0, -0.42, 1.58]}>
				<boxGeometry args={[9.35, 0.1, 0.18]} />

				<meshStandardMaterial color="#754a2e" roughness={0.5} />
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

			{/* ======================================================== */}
			{/* LEFT SOCIAL ICONS                                          */}
			{/* ======================================================== */}

			<Text
				position={[-3.35, -0.55, 1.74]}
				fontSize={0.24}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				♥
			</Text>

			<Text
				position={[-2.88, -0.55, 1.74]}
				fontSize={0.22}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				○
			</Text>

			<Text
				position={[-2.4, -0.55, 1.74]}
				fontSize={0.22}
				anchorX="center"
				anchorY="middle"
				color="#ffffff"
			>
				➤
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
	onTakeSelfie,
	cameraTexture,
}: SelfieBoothModelProps) {
	const glowRef = useRef<THREE.Mesh>(null);

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

	const dotTexture = useMemo(() => {
		if (typeof document === "undefined") {
			return undefined;
		}

		return createIdleScreenTexture();
	}, []);

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

			{/* Physical dark 3D bezel */}
			<RoundedPanel
				position={[0, 4.05, -0.25]}
				size={[6.15, 5.15, 0.18]}
				radius={0.38}
				color="#101a2a"
			/>

			{/* Actual camera display */}
			<CameraScreen
				texture={cameraTexture}
				dotTexture={dotTexture ?? new THREE.Texture()}
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
				emojiGlyph="☺"
				thirdGlyph="#"
			/>

			<SideDecorations
				position={[3.92, 4.05, -0.12]}
				badgeText="CAPTURE SHARE INSPIRE"
				emojiGlyph="♡"
				thirdGlyph="➤"
			/>

			{/* ============================================================ */}
			{/* COUNTER                                                       */}
			{/* ============================================================ */}

			<Counter />
		</group>
	);
}
