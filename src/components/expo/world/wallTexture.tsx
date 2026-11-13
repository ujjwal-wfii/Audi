import { useMemo, useLayoutEffect } from "react";
import * as THREE from "three";
import { Text, useTexture } from "@react-three/drei";

/**
 * Modern wall treatment for the hall (60 x 85 m, from hall_layout_v4.json).
 * Layers, bottom to top: skirting, charcoal band, teal accent line, light plaster.
 * Rear + front walls get a navy feature panel; the front wall has the 8 m main-door gap.
 *
 * Usage (inside <Canvas>), and delete your old wall meshes:
 *   <HallWalls eventName="OPEXN" />                       // procedural textures, no files
 *   <HallWalls eventName="OPEXN" textures={{...}} />      // prebuilt textures (see bottom)
 */

const HALL = { x0: -30, x1: 30, z0: -42, z1: 43 };
const DOOR = { a: -4, b: 4, h: 4.5 }; // main exit, local wall coords
const COLORS = {
	plaster: "#D9DCE0",
	band: "#2B2F36",
	skirt: "#14171C",
	teal: "#0E8A80",
	navy: "#0B1220",
};
const BAND_TOP = 2.5;
const TRIM = 0.15;
const STRIP = 0.08;

/* ---------- procedural textures (grey-scale, tinted by material colour) ---------- */
function makeCanvasTexture(draw, size = 512) {
	const c = document.createElement("canvas");
	c.width = c.height = size;
	draw(c.getContext("2d"), size);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}
const noise = (ctx, size, base, spread, count) => {
	ctx.fillStyle = `rgb(${base},${base},${base})`;
	ctx.fillRect(0, 0, size, size);
	for (let i = 0; i < count; i++) {
		const v = base + (Math.random() - 0.5) * spread;
		ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
		ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
	}
};

function useProceduralMaps() {
	return useMemo(() => {
		const plaster = makeCanvasTexture((ctx, s) =>
			noise(ctx, s, 240, 26, 14000),
		);
		const slat = makeCanvasTexture((ctx, s) => {
			noise(ctx, s, 215, 18, 9000);
			for (let x = 0; x < s; x += 32) {
				ctx.fillStyle = "rgba(0,0,0,0.45)"; // groove between slats
				ctx.fillRect(x, 0, 5, s);
				ctx.fillStyle = "rgba(255,255,255,0.12)"; // highlight edge
				ctx.fillRect(x + 5, 0, 2, s);
			}
		});
		return {
			plaster: { map: plaster, bumpMap: plaster, bumpScale: 0.4 },
			band: { map: slat, bumpMap: slat, bumpScale: 1.2 },
		};
	}, []);
}

/* ---------- geometry helpers ---------- */
// Flat panel; UVs are scaled to real metres so textures never stretch.
function Panel({ u0, u1, y0, y1, material, tile = 2 }) {
	const w = u1 - u0;
	const h = y1 - y0;
	const geo = useMemo(() => {
		const g = new THREE.PlaneGeometry(w, h);
		const uv = g.attributes.uv;
		for (let i = 0; i < uv.count; i++) {
			uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
		}
		return g;
	}, [w, h, tile]);
	return (
		<mesh
			geometry={geo}
			material={material}
			position={[(u0 + u1) / 2, (y0 + y1) / 2, 0]}
		/>
	);
}

// Thin box that sticks out of the wall (skirting, accent line, door frame)
function Trim({ u0, u1, y0, y1, depth = 0.05, material }) {
	return (
		<mesh
			material={material}
			position={[(u0 + u1) / 2, (y0 + y1) / 2, depth / 2]}
		>
			<boxGeometry args={[u1 - u0, y1 - y0, depth]} />
		</mesh>
	);
}

function FeaturePanel({ width, y0, y1, label, sub, mats }) {
	const cy = (y0 + y1) / 2;
	return (
		<group position={[0, 0, 0.03]}>
			<Panel
				u0={-width / 2}
				u1={width / 2}
				y0={y0}
				y1={y1}
				material={mats.navy}
			/>
			<Trim
				u0={-width / 2}
				u1={width / 2}
				y0={y0 - STRIP}
				y1={y0}
				depth={0.04}
				material={mats.strip}
			/>
			<Text
				position={[0, cy + 0.5, 0.02]}
				fontSize={(y1 - y0) * 0.32}
				color="#FFFFFF"
				anchorX="center"
				anchorY="middle"
				letterSpacing={0.08}
			>
				{label}
			</Text>
			{sub && (
				<Text
					position={[0, cy - (y1 - y0) * 0.25, 0.02]}
					fontSize={(y1 - y0) * 0.1}
					color={COLORS.teal}
					anchorX="center"
					anchorY="middle"
					letterSpacing={0.2}
				>
					{sub}
				</Text>
			)}
		</group>
	);
}

/* ---------- one wall: local x = along the wall, local z = into the hall ---------- */
function Wall({ origin, rotY, u0, u1, door, height, mats, feature }) {
	// split a horizontal layer around the door gap
	const cuts = (y0, y1) => {
		if (!door) return [[u0, u1, y0, y1]];
		const out = [];
		const top = Math.min(y1, door.h);
		if (top > y0) out.push([u0, door.a, y0, top], [door.b, u1, y0, top]);
		if (y1 > door.h) out.push([u0, u1, Math.max(y0, door.h), y1]);
		return out;
	};
	return (
		<group position={origin} rotation={[0, rotY, 0]}>
			{cuts(TRIM, BAND_TOP).map((r, i) => (
				<Panel
					key={`b${i}`}
					u0={r[0]}
					u1={r[1]}
					y0={r[2]}
					y1={r[3]}
					material={mats.band}
				/>
			))}
			{cuts(BAND_TOP + STRIP, height).map((r, i) => (
				<Panel
					key={`p${i}`}
					u0={r[0]}
					u1={r[1]}
					y0={r[2]}
					y1={r[3]}
					material={mats.plaster}
				/>
			))}
			{cuts(0, TRIM).map((r, i) => (
				<Trim
					key={`s${i}`}
					u0={r[0]}
					u1={r[1]}
					y0={r[2]}
					y1={r[3]}
					depth={0.06}
					material={mats.skirt}
				/>
			))}
			{cuts(BAND_TOP, BAND_TOP + STRIP).map((r, i) => (
				<Trim
					key={`t${i}`}
					u0={r[0]}
					u1={r[1]}
					y0={r[2]}
					y1={r[3]}
					depth={0.04}
					material={mats.strip}
				/>
			))}
			{door && (
				<>
					<Trim
						u0={door.a - 0.2}
						u1={door.a}
						y0={0}
						y1={door.h}
						depth={0.15}
						material={mats.skirt}
					/>
					<Trim
						u0={door.b}
						u1={door.b + 0.2}
						y0={0}
						y1={door.h}
						depth={0.15}
						material={mats.skirt}
					/>
					<Trim
						u0={door.a - 0.2}
						u1={door.b + 0.2}
						y0={door.h}
						y1={door.h + 0.2}
						depth={0.15}
						material={mats.skirt}
					/>
				</>
			)}
			{feature}
		</group>
	);
}

function WallSet({ maps, height, eventName }) {
	const mats = useMemo(
		() => ({
			plaster: new THREE.MeshStandardMaterial({
				color: COLORS.plaster,
				roughness: 0.85,
				...maps.plaster,
			}),
			band: new THREE.MeshStandardMaterial({
				color: COLORS.band,
				roughness: 0.6,
				...maps.band,
			}),
			skirt: new THREE.MeshStandardMaterial({
				color: COLORS.skirt,
				roughness: 0.5,
				metalness: 0.4,
			}),
			navy: new THREE.MeshStandardMaterial({
				color: COLORS.navy,
				roughness: 0.7,
			}),
			strip: new THREE.MeshStandardMaterial({
				color: COLORS.teal,
				emissive: COLORS.teal,
				emissiveIntensity: 1.4,
				toneMapped: false,
			}),
		}),
		[maps],
	);
	const cz = (HALL.z0 + HALL.z1) / 2;
	const lenX = HALL.x1 - HALL.x0;
	const lenZ = HALL.z1 - HALL.z0;
	const common = { height, mats };
	return (
		<group>
			{/* rear wall (z = -42), faces +z. Feature panel sits above SP1/SP2 (they are 4.5 m tall) */}
			<Wall
				{...common}
				origin={[0, 0, HALL.z0]}
				rotY={0}
				u0={-lenX / 2}
				u1={lenX / 2}
				feature={
					<FeaturePanel
						width={48}
						y0={5.6}
						y1={height - 1.2}
						label={eventName}
						sub="EXHIBITION HALL"
						mats={mats}
					/>
				}
			/>
			{/* front wall (z = 43), faces -z, with the main exit gap */}
			<Wall
				{...common}
				origin={[0, 0, HALL.z1]}
				rotY={Math.PI}
				u0={-lenX / 2}
				u1={lenX / 2}
				door={DOOR}
				feature={
					<FeaturePanel
						width={24}
						y0={6.4}
						y1={height - 1.2}
						label={`Welcome to ${eventName}`}
						mats={mats}
					/>
				}
			/>
			{/* left wall (x = -30), faces +x */}
			<Wall
				{...common}
				origin={[HALL.x0, 0, cz]}
				rotY={Math.PI / 2}
				u0={-lenZ / 2}
				u1={lenZ / 2}
			/>
			{/* right wall (x = 30), faces -x */}
			<Wall
				{...common}
				origin={[HALL.x1, 0, cz]}
				rotY={-Math.PI / 2}
				u0={-lenZ / 2}
				u1={lenZ / 2}
			/>
		</group>
	);
}

/* ---------- procedural vs prebuilt textures ---------- */
function ProceduralWalls(props) {
	return <WallSet maps={useProceduralMaps()} {...props} />;
}

function FileWalls({ textures, ...props }) {
	const plaster = useTexture(textures.plaster);
	const band = useTexture(textures.band);
	useLayoutEffect(() => {
		[plaster, band].forEach((set) =>
			Object.entries(set).forEach(([key, t]) => {
				t.wrapS = t.wrapT = THREE.RepeatWrapping;
				t.anisotropy = 8;
				if (key === "map") t.colorSpace = THREE.SRGBColorSpace;
				t.needsUpdate = true;
			}),
		);
	}, [plaster, band]);
	return <WallSet maps={{ plaster, band }} {...props} />;
}

export default function HallWalls({
	height = 12,
	eventName = "OPEXN",
	textures,
}) {
	return textures ? (
		<FileWalls textures={textures} height={height} eventName={eventName} />
	) : (
		<ProceduralWalls height={height} eventName={eventName} />
	);
}

/* Prebuilt textures: download CC0 sets (e.g. from Poly Haven or ambientCG) into /public/textures
   and pass them like this. Each key is a three.js material slot.

   <HallWalls
     textures={{
       plaster: {
         map: "/textures/plaster/diff.jpg",
         normalMap: "/textures/plaster/nor.jpg",
         roughnessMap: "/textures/plaster/rough.jpg",
       },
       band: {
         map: "/textures/fabric/diff.jpg",
         normalMap: "/textures/fabric/nor.jpg",
         roughnessMap: "/textures/fabric/rough.jpg",
       },
     }}
   />
*/
