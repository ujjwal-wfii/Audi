"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import type { StallVisualProps } from "./stallTypes";
import ReceptionistModel from "./ReceptionistModel";

/**
 * SmallStall: visual model of one small stall (metres, origin = footprint centre,
 * entrance faces +Z at rotationY = 0, rotationY in radians).
 *
 * Textures (all optional, a missing file keeps the slot's fallback colour):
 *   /textures/stalls/wall_color.jpg, floor_color.jpg, counter_color.jpg
 *   (+ floor relief maps when stallTextureConfig.normalMaps is on)
 */

// ---------------------------------------------------------------------------
// Texture configuration
// ---------------------------------------------------------------------------

export type StallSlot = "flat" | "wall" | "floor" | "counter";
type TexturedSlot = Exclude<StallSlot, "flat">;

// Set before the first stall renders. Low tier: enabled = false (no texture memory).
export const stallTextureConfig = {
	enabled: true,
	normalMaps: true, // true = MeshStandardMaterial + normal maps (3D relief)
	basePath: "/textures/stalls",
};

// file: file-name prefix | tile: metres per texture repeat
// fallback: colour when no texture | tint: colour multiplied with the loaded texture
const SLOT_DEFS: Record<
	TexturedSlot,
	{
		file: string;
		tile: number;
		fallback: string;
		tint: string;
		normalFile?: string;
		roughnessFile?: string;
	}
> = {
	wall: { file: "wall", tile: 1.2, fallback: "#F1F2F4", tint: "#FFFFFF" },
	floor: {
		file: "floor",
		tile: 0.65,
		fallback: "#3B4048",
		tint: "#FFFFFF",
		normalFile: "dirty_carpet_nor_gl_1k.exr",
		roughnessFile: "dirty_carpet_rough_1k.exr",
	},
	counter: {
		file: "counter",
		tile: 1.0,
		fallback: "#F5F5F2",
		tint: "#FFFFFF",
	},
};

const SLOT_ORDER: StallSlot[] = ["flat", "wall", "floor", "counter"];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_W = 2.4;
const MIN_H = 2.6;
const MIN_D = 2.4;
const DEFAULT_ACCENT = "#2F7F7B";

const FLOOR_T = 0.12;
const CARPET_T = 0.015;
const FLOOR_TOP = FLOOR_T + CARPET_T;
const BEAM = 0.12;
const BACK_WALL_T = 0.1;

// How far the brand panel sits below the top of the back wall (was a magic
// "- 0.3" inside the panel call, which the screen and logo anchor ignored).
const BRAND_DROP = 0.3;

// Receptionist placement (relative to the counter so it follows every stall size).
// y/rotation/scale are the values you had; gap = distance behind the counter.
const RECEPTIONIST_Y = 1;
const RECEPTIONIST_GAP = 0.45;

const C = {
	frame: "#F8F8F5",
	pillar: "#7D8790",
	wallTrim: "#AEB8BE",
	skirt: "#C4CCD0",
	canopy: "#E1E5E6",
	floor: "#C5CBCB",
	dark: "#25272A",
	divider: "#34434A",
	screenHousing: "#202225",
	screenFace: "#334155",
	screenSheen: "#D5E8E4",
	shelf: "#D9DAD6",
	trim: "#BFC1B9",
	counterTop: "#FDFDFB",
	lightPanel: "#FFF3C4",
	canopyInner: "#F5F6F7",
	counterShadow: "#D7DBE0",
	blueTrim: "#2F7F7B",
	white: "#FFFFFF",
	black: "#000000",
} as const;

// ---------------------------------------------------------------------------
// Materials and textures (shared by all stalls)
// ---------------------------------------------------------------------------

const FLAT_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

const textureLoader = new THREE.TextureLoader();
const exrLoader = new EXRLoader();
const textureCache = new Map<string, THREE.Texture>();
const materialCache = new Map<string, THREE.Material>();

// FIX: loads that are still running are tracked, so two materials asking for the
// same file share one request, and a load that finishes after
// disposeSmallStallCaches() is discarded instead of leaking back into the cache.
const pendingLoads = new Map<string, Array<(t: THREE.Texture) => void>>();
let cacheEpoch = 0;

// Loads one texture file. If the file is missing, the fallback colour stays.
function loadTexture(
	url: string,
	isColor: boolean,
	onLoad: (t: THREE.Texture) => void,
) {
	if (typeof window === "undefined") return;
	const cached = textureCache.get(url);
	if (cached) {
		onLoad(cached);
		return;
	}
	const waiting = pendingLoads.get(url);
	if (waiting) {
		waiting.push(onLoad);
		return;
	}

	const epoch = cacheEpoch;
	pendingLoads.set(url, [onLoad]);

	const handleLoad = (t: THREE.Texture) => {
		if (epoch !== cacheEpoch) {
			t.dispose(); // caches were cleared while this was loading
			return;
		}
		const callbacks = pendingLoads.get(url) ?? [];
		pendingLoads.delete(url);
		t.wrapS = t.wrapT = THREE.RepeatWrapping; // tile across large walls
		t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace; // normals stay linear
		t.anisotropy = 4;
		textureCache.set(url, t);
		callbacks.forEach((cb) => cb(t));
	};
	const handleError = () => {
		/* file missing: keep the fallback colour */
		if (epoch === cacheEpoch) pendingLoads.delete(url);
	};
	if (url.endsWith(".exr")) {
		exrLoader.load(url, handleLoad, undefined, handleError);
	} else {
		textureLoader.load(url, handleLoad, undefined, handleError);
	}
}

// Shared material per slot. Lambert + colour map by default,
// Standard + normal map when normalMaps is on. Textures are applied when they arrive.
function getSlotMaterial(slot: StallSlot): THREE.Material {
	if (slot === "flat") return FLAT_MATERIAL;
	const cfg = stallTextureConfig;
	const key = `${slot}|${cfg.normalMaps}|${cfg.basePath}`;
	const hit = materialCache.get(key);
	if (hit) return hit;

	const def = SLOT_DEFS[slot];
	const standard = cfg.normalMaps;
	const mat: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial = standard
		? new THREE.MeshStandardMaterial({
				color: def.fallback,
				roughness: 0.9,
				metalness: 0,
			})
		: new THREE.MeshLambertMaterial({ color: def.fallback });

	loadTexture(`${cfg.basePath}/${def.file}_color.jpg`, true, (t) => {
		mat.map = t;
		mat.color.set(def.tint);
		mat.needsUpdate = true;
	});
	if (standard) {
		if (def.normalFile) {
			loadTexture(`${cfg.basePath}/${def.normalFile}`, false, (t) => {
				const standardMat = mat as THREE.MeshStandardMaterial;
				standardMat.normalMap = t;
				standardMat.normalScale.set(0.7, 0.7);
				standardMat.needsUpdate = true;
			});
		}
		if (def.roughnessFile) {
			loadTexture(`${cfg.basePath}/${def.roughnessFile}`, false, (t) => {
				const standardMat = mat as THREE.MeshStandardMaterial;
				standardMat.roughnessMap = t;
				standardMat.roughness = 1;
				standardMat.needsUpdate = true;
			});
		}
	}
	materialCache.set(key, mat);
	return mat;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const _color = new THREE.Color();

function paint(geo: THREE.BufferGeometry, hex: string) {
	_color.set(hex);
	const count = geo.getAttribute("position").count;
	const colors = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		colors[i * 3] = _color.r;
		colors[i * 3 + 1] = _color.g;
		colors[i * 3 + 2] = _color.b;
	}
	geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	return geo;
}

// Texture UVs from world positions: a texture keeps the same real-world size
// (`tile` metres) on every face and part, instead of stretching per box.
function worldUV(geo: THREE.BufferGeometry, tile: number) {
	const pos = geo.getAttribute("position");
	const nor = geo.getAttribute("normal");
	const uv = geo.getAttribute("uv");
	for (let i = 0; i < pos.count; i++) {
		const ax = Math.abs(nor.getX(i));
		const ay = Math.abs(nor.getY(i));
		const az = Math.abs(nor.getZ(i));
		let u: number;
		let v: number;
		if (ax >= ay && ax >= az) {
			u = pos.getZ(i);
			v = pos.getY(i);
		} else if (ay >= az) {
			u = pos.getX(i);
			v = pos.getZ(i);
		} else {
			u = pos.getX(i);
			v = pos.getY(i);
		}
		uv.setXY(i, u / tile, v / tile);
	}
	uv.needsUpdate = true;
}

// box(size x,y,z, centre x,y,z, colour)
const box = (
	sx: number,
	sy: number,
	sz: number,
	x: number,
	y: number,
	z: number,
	hex: string,
) => {
	const g = new THREE.BoxGeometry(sx, sy, sz);
	g.translate(x, y, z);
	return paint(g, hex);
};

const cyl = (
	r: number,
	h: number,
	seg: number,
	x: number,
	y: number,
	z: number,
	hex: string,
) => {
	const g = new THREE.CylinderGeometry(r, r, h, seg);
	g.translate(x, y, z);
	return paint(g, hex);
};

// Plane facing down (ceiling light panels)
const downPlane = (
	sx: number,
	sz: number,
	x: number,
	y: number,
	z: number,
	hex: string,
) => {
	const g = new THREE.PlaneGeometry(sx, sz);
	g.rotateX(Math.PI / 2);
	g.translate(x, y, z);
	return paint(g, hex);
};

// ---------------------------------------------------------------------------
// Layout numbers shared by the geometry and the component
// ---------------------------------------------------------------------------

const fasciaHeight = (h: number) => THREE.MathUtils.clamp(h * 0.13, 0.3, 0.5);

function computeLayout(w: number, h: number, d: number) {
	const innerW = w - 2 * BEAM;
	const wallTop = h - BEAM;
	const wallH = wallTop - FLOOR_T;
	const B = -d / 2;
	const F = d / 2;
	const zIn = B + BACK_WALL_T;
	const brandW = innerW * 0.7;
	const brandH = Math.min(3.0, wallH * 0.42);
	// FIX: the drop is part of brandY now, so the screen, shelves and the
	// anchor_logo group all agree with where the panel really is.
	const brandY = wallTop - 0.2 - brandH / 2 - BRAND_DROP;

	// FIX: the counter used a hard-coded x = 0.8, which pushed it through the
	// right wall on narrow stalls. Clamp it so it always stays inside the walls.
	const cw = Math.min(1.8, innerW * 0.5);
	const cd = Math.min(0.6, d * 0.2);
	const cx = Math.min(0.8, innerW / 2 - 0.1 - (cw + 0.1) / 2);
	const cz = F - 0.5 - cd / 2;

	return {
		L: -w / 2,
		R: w / 2,
		B,
		F,
		innerW,
		wallTop,
		wallH,
		fasciaH: fasciaHeight(h),
		zIn,
		brandW,
		brandH,
		brandY,
		cw,
		cd,
		cx,
		cz,
	};
}

function signSize(w: number, h: number) {
	const signW = Math.min(fasciaHeight(h) * 0.7 * 4, w - 2 * BEAM - 0.2);
	return { signW, signH: signW / 4 };
}

// ---------------------------------------------------------------------------
// Stall body (built once per size + accent + texture mode, then cached)
// ---------------------------------------------------------------------------

type Body = { geometry: THREE.BufferGeometry; slots: StallSlot[] };

function buildBody(
	w: number,
	h: number,
	d: number,
	accent: string,
	textured: boolean,
): Body {
	const {
		L,
		R,
		B,
		F,
		innerW,
		wallH,
		fasciaH,
		zIn,
		brandW,
		brandH,
		brandY,
		cw,
		cd,
		cx,
		cz,
	} = computeLayout(w, h, d);
	const wallMidY = FLOOR_T + wallH / 2;

	const buckets: Record<StallSlot, THREE.BufferGeometry[]> = {
		flat: [],
		wall: [],
		floor: [],
		counter: [],
	};

	// Textured slots get white vertex colours + world UVs; everything else is flat colour.
	const add = (g: THREE.BufferGeometry, slot: StallSlot = "flat") => {
		if (textured && slot !== "flat") {
			paint(g, C.white);
			worldUV(g, SLOT_DEFS[slot].tile);
			buckets[slot].push(g);
		} else {
			buckets.flat.push(g);
		}
	};

	// ---- Floor platform, carpet (texture: floor), entrance threshold ----------
	add(box(w, FLOOR_T, d, 0, FLOOR_T / 2, 0, C.floor));
	const carpetLen = F - 0.1 - zIn;
	add(
		box(
			innerW,
			CARPET_T,
			carpetLen,
			0,
			FLOOR_T + CARPET_T / 2,
			zIn + carpetLen / 2,
			SLOT_DEFS.floor.fallback,
		),
		"floor",
	);
	add(box(innerW, 0.03, 0.1, 0, FLOOR_T + 0.015, F - 0.05, C.frame));
	// UI: thin accent line on the threshold so the entrance reads clearly.
	add(box(innerW, 0.004, 0.02, 0, FLOOR_T + 0.032, F - 0.05, accent));

	// ---- Walls: left, right, back (texture: wall) ------------------------------
	const sideLen = d - BEAM;
	const sideZ = (B + F - BEAM) / 2;
	add(
		box(
			BEAM,
			wallH,
			sideLen,
			L + BEAM / 2,
			wallMidY,
			sideZ,
			SLOT_DEFS.wall.fallback,
		),
		"wall",
	);
	add(
		box(
			BEAM,
			wallH,
			sideLen,
			R - BEAM / 2,
			wallMidY,
			sideZ,
			SLOT_DEFS.wall.fallback,
		),
		"wall",
	);
	add(
		box(
			innerW,
			wallH,
			BACK_WALL_T,
			0,
			wallMidY,
			B + BACK_WALL_T / 2,
			SLOT_DEFS.wall.fallback,
		),
		"wall",
	);

	// ---- Wall joints: corner trims, skirting, top cove, panel seams ------------
	const TRIM = 0.04;
	const inX = innerW / 2;
	const sideStart = zIn + TRIM;
	const sideRun = F - BEAM - sideStart;
	const wallTop2 = FLOOR_T + wallH;
	add(
		box(
			innerW - 2 * TRIM,
			0.1,
			0.02,
			0,
			FLOOR_TOP + 0.05,
			zIn + 0.01,
			C.skirt,
		),
	); // back skirting
	add(
		box(
			innerW - 2 * TRIM,
			0.06,
			TRIM,
			0,
			wallTop2 - 0.03,
			zIn + TRIM / 2,
			C.wallTrim,
		),
	); // back cove
	for (const s of [-1, 1]) {
		add(
			box(
				TRIM,
				wallH,
				TRIM,
				s * (inX - TRIM / 2),
				wallMidY,
				zIn + TRIM / 2,
				C.wallTrim,
			),
		); // corner trim
		add(
			box(
				0.02,
				0.1,
				sideRun,
				s * (inX - 0.01),
				FLOOR_TOP + 0.05,
				sideStart + sideRun / 2,
				C.skirt,
			),
		); // side skirting
		add(
			box(
				TRIM,
				0.06,
				sideRun,
				s * (inX - TRIM / 2),
				wallTop2 - 0.03,
				sideStart + sideRun / 2,
				C.wallTrim,
			),
		); // side cove
		add(
			box(
				0.012,
				wallH,
				0.006,
				s * (innerW / 6),
				wallMidY,
				zIn + 0.003,
				C.wallTrim,
			),
		); // back wall seam
		add(
			box(
				0.006,
				wallH,
				0.012,
				s * (inX - 0.003),
				wallMidY,
				0,
				C.wallTrim,
			),
		); // side wall seam
	}

	// ---- Pillars (+ accent stripe) and canopy beams ----------------------------
	for (const s of [-1, 1]) {
		const px = s * (w / 2 - BEAM / 2);
		add(
			box(
				BEAM,
				wallH + 0.2,
				BEAM - 0.01,
				px,
				wallMidY + 0.01,
				F - 0.01 - (BEAM - 0.01) / 2,
				C.pillar,
			),
		); // pillar
		add(
			box(
				0.1,
				wallH + 0.2,
				0.001,
				px,
				wallMidY + 0.01,
				F - 0.005,
				C.dark,
			),
		); // pillar stripe
		// add(box(BEAM, BEAM, d, px, h - BEAM / 2, 0, C.canopy)); // side canopy beam
	}
	// A dark outer spine keeps adjacent stalls visually separate even when their
	// side walls touch and receive the same light.
	for (const s of [-1, 1]) {
		const dividerX = s * (w / 2 + 0.012);
		add(
			box(
				0.07,
				wallH + 0.08,
				sideLen,
				dividerX,
				wallMidY + 0.01,
				sideZ,
				C.divider,
			),
		);
		add(
			box(
				0.09,
				0.09,
				0.11,
				dividerX,
				wallTop2 - 0.045,
				F - 0.055,
				C.divider,
			),
		);
	}
	add(box(innerW, fasciaH, BEAM, 0, h - fasciaH / 2, F - BEAM / 2, C.frame)); // front fascia
	add(box(innerW, BEAM, BEAM, 0, h - BEAM / 2, B + BEAM / 2, C.canopy)); // rear canopy beam
	add(
		box(
			innerW + 0.01,
			0.03,
			BEAM,
			0,
			h - fasciaH - 0.015,
			F - BEAM / 2 + 0.01,
			accent,
		),
	); // accent underline

	// ---- Finished canopy: solid panel + recessed-looking lights -----------------
	// A thin ceiling panel gives the stall a finished architectural silhouette.
	// It is merged into the same body geometry, so it adds no extra React meshes.
	const canopyDepth = Math.max(0.5, d - 2 * BEAM - 0.04);
	const canopyWidth = Math.max(0.5, innerW - 0.04);
	const canopyY = h - BEAM / 2 - 0.07;
	add(box(canopyWidth, 0.06, canopyDepth, 0, canopyY, 0, C.canopyInner));

	// Fine inner perimeter trim makes the ceiling read as a designed panel.
	add(
		box(
			canopyWidth,
			0.025,
			0.025,
			0,
			canopyY - 0.032,
			-canopyDepth / 2 + 0.02,
			C.trim,
		),
	);
	add(
		box(
			canopyWidth,
			0.025,
			0.025,
			0,
			canopyY - 0.032,
			canopyDepth / 2 - 0.02,
			C.trim,
		),
	);
	for (const side of [-1, 1]) {
		add(
			box(
				0.025,
				0.025,
				canopyDepth,
				side * (canopyWidth / 2 - 0.0125),
				canopyY - 0.032,
				0,
				C.trim,
			),
		);
	}

	// Four compact light panels on the underside. Basic emissive-style colour is
	// deliberately used instead of real point lights to avoid 4 extra lights/stall.
	const lightW = Math.min(0.42, innerW * 0.22);
	const lightD = 0.22;
	const lightY = canopyY - 0.0315;
	for (const zf of [-0.24, 0.24]) {
		for (const xf of [-0.25, 0.25]) {
			const x = xf * innerW;
			const z = zf * canopyDepth;
			add(box(lightW + 0.06, 0.025, lightD + 0.06, x, lightY, z, C.trim));
			// FIX: the lit plane sat 0.5 mm below its frame, which z-fights at
			// distance. 2.5 mm below the frame is stable.
			add(downPlane(lightW, lightD, x, lightY - 0.015, z, C.lightPanel));
		}
	}

	// ---- Back wall: brand panel + logo plate -----------------------------------
	// add(box(brandW, brandH, 0.03, 0, brandY, zIn + 0.015, accent));
	add(
		box(
			brandW + 0.08,
			brandH + 0.08,
			0.04,
			0,
			brandY,
			zIn + 0.02,
			C.screenHousing,
		),
	); // housing
	add(box(brandW, brandH, 0.004, 0, brandY, zIn + 0.042, C.screenFace));
	// A slim lower rail separates the branding panel from the screen zone.
	// add(
	// 	box(
	// 		brandW,
	// 		0.035,
	// 		0.025,
	// 		0,
	// 		brandY - brandH / 2 - 0.025,
	// 		zIn + 0.02,
	// 		C.blueTrim,
	// 	),
	// );
	// add(
	// 	box(
	// 		brandW * 0.32,
	// 		brandH * 0.7,
	// 		0.012,
	// 		0,
	// 		brandY,
	// 		zIn + 0.036,
	// 		C.white,
	// 	),
	// );

	// ---- Back wall: display screen + shelves -----------------------------------
	const sw = Math.min(1.5, innerW * 0.4);
	const sh = sw * 0.5625;
	const brandBottom = brandY - brandH / 2;
	const sy = Math.min(FLOOR_TOP + 1.15, brandBottom - 0.2 - (sh + 0.08) / 2);

	// FIX: sw / sh / sy were computed but the screen itself was never added
	// (C.screenHousing / screenFace / screenSheen were unused). Restored.
	// panel
	const shelfW = Math.min(0.8, innerW / 2 - (sw / 2 + 0.04) - 0.25);
	if (shelfW > 0.35) {
		for (const s of [-1, 1]) {
			const x = s * (sw / 2 + 0.04 + 0.15 + shelfW / 2);
			[sy - 0.25, sy + 0.25].forEach((y, i) => {
				add(box(shelfW, 0.04, 0.24, x, y, zIn + 0.12, C.shelf));
				add(
					box(
						0.18,
						0.2,
						0.12,
						x + (i ? -0.15 : 0.15) * s,
						y + 0.12,
						zIn + 0.12,
						i ? C.dark : accent,
					),
				);
			});
		}
	}

	// ---- Side wall accent strips ------------------------------------------------
	// FIX: strips were centred 0.01 off the wall face, so they floated 5 mm in
	// front of it. Now flush with the wall (face at inX, 0.01 thick).
	// for (const s of [-1, 1]) {
	// 	// add(
	// 	// 	box(
	// 	// 		0.01,
	// 	// 		wallH * 0.8,
	// 	// 		d * 0.8,
	// 	// 		s * (innerW / 2 - 0.005),
	// 	// 		FLOOR_T + wallH * 0.5,
	// 	// 		0 * d,
	// 	// 		accent,
	// 	// 	),
	// 	// );
	// }
	add(
		box(
			0.02,
			wallH * 0.8,
			d * 0.8,
			-1 * (innerW / 2 - 0.01),
			FLOOR_T + wallH * 0.5,
			0 * d,
			accent,
		),
	);
	add(
		box(
			0.02,
			wallH * 0.4,
			d * 0.4,
			1 * (innerW / 2 - 0.01),
			FLOOR_T + wallH * 0.5,
			0 * d,
			accent,
		),
	);

	// ---- Reception counter: body (texture: counter), front panel, top ----------
	// (cw, cd, cx, cz come from computeLayout so the receptionist can use them too)
	const bodyH = 0.9;
	add(
		box(
			cw,
			bodyH,
			cd,
			cx,
			FLOOR_TOP + bodyH / 2,
			cz,
			SLOT_DEFS.counter.fallback,
		),
		"counter",
	);
	add(
		box(
			cw * 0.92,
			bodyH * 0.7,
			0.02,
			cx,
			FLOOR_TOP + bodyH * 0.5,
			cz + cd / 2 + 0.01,
			accent,
		),
	);
	add(
		box(
			cw + 0.1,
			0.065,
			cd + 0.1,
			cx,
			FLOOR_TOP + bodyH + 0.0325,
			cz,
			C.counterTop,
		),
	);
	// Slim blue reveal beneath the countertop and a recessed-looking toe kick.
	add(
		box(
			cw + 0.02,
			0.025,
			cd + 0.02,
			cx,
			FLOOR_TOP + bodyH - 0.018,
			cz,
			C.black,
		),
	);

	// Fine side returns make the yellow front panel look inset rather than painted on.
	for (const side of [-1, 1]) {
		add(
			box(
				0.025,
				bodyH * 0.76,
				cd * 0.72,
				cx + side * (cw * 0.47),
				FLOOR_TOP + bodyH * 0.48,
				cz,
				C.counterShadow,
			),
		);
	}

	// ---- Stool (base, pole, seat) ------------------------------------------------
	const stool = (x: number, z: number, seatTop: number, seatHex: string) => {
		const base = 0.02;
		const seat = 0.04;
		const pole = seatTop - seat - base;
		add(cyl(0.16, base, 8, x, FLOOR_TOP + base / 2, z, C.dark));
		add(cyl(0.02, pole, 6, x, FLOOR_TOP + base + pole / 2, z, C.trim));
		add(cyl(0.17, seat, 8, x, FLOOR_TOP + seatTop - seat / 2, z, seatHex));
	};

	// // ---- Roll-up banner (left) ----------------------------------------------------
	// const bx = L + BEAM + 0.6;
	// const bz = 0.15 * d;
	// const bannerH = Math.min(1.9, h - fasciaH - FLOOR_TOP - 0.25);
	// add(box(0.85, 0.05, 0.2, bx, FLOOR_TOP + 0.025, bz + 1.8, C.dark));
	// const bannerZ = bz + 1.8; // Intentional front-left display position in the current layout.
	// const bannerY = FLOOR_TOP + 0.05 + bannerH / 2;
	// add(box(0.8, bannerH, 0.03, bx, bannerY, bannerZ, accent));
	// // Narrow dark rails and a top cassette give the banner a real roll-up stand look.
	// add(
	// 	box(
	// 		0.025,
	// 		bannerH,
	// 		0.045,
	// 		bx - 0.405,
	// 		bannerY,
	// 		bannerZ + 0.006,
	// 		C.dark,
	// 	),
	// );
	// add(
	// 	box(
	// 		0.025,
	// 		bannerH,
	// 		0.045,
	// 		bx + 0.405,
	// 		bannerY,
	// 		bannerZ + 0.006,
	// 		C.dark,
	// 	),
	// );
	// add(
	// 	box(
	// 		0.84,
	// 		0.03,
	// 		0.045,
	// 		bx,
	// 		bannerY + bannerH / 2 + 0.012,
	// 		bannerZ + 0.006,
	// 		C.trim,
	// 	),
	// );
	// // Thin lower cassette remains aligned with the original banner base.
	// add(box(0.82, 0.035, 0.22, bx, FLOOR_TOP + 0.035, bannerZ, C.dark));

	// ---- Meeting table + 2 stools (right) ------------------------------------------
	const tx = R - BEAM - 0.9;
	const tz = -0.15 * d;
	add(cyl(0.25, 0.02, 12, tx, FLOOR_TOP + 0.01, tz, C.dark));
	add(cyl(0.03, 0.68, 6, tx, FLOOR_TOP + 0.02 + 0.34, tz, C.trim));
	add(cyl(0.4, 0.04, 12, tx, FLOOR_TOP + 0.72, tz, C.counterTop));
	stool(tx, tz + 0.62, 0.45, C.dark);
	stool(tx + 0.62, tz, 0.45, accent);

	// ---- Merge: one geometry per slot, then one geometry with a material group per slot
	const slots: StallSlot[] = [];
	const perSlot: THREE.BufferGeometry[] = [];
	for (const slot of SLOT_ORDER) {
		if (!buckets[slot].length) continue;
		const m = mergeGeometries(buckets[slot], false);
		buckets[slot].forEach((g) => g.dispose());
		if (!m) throw new Error(`SmallStall: failed to merge slot "${slot}"`);
		slots.push(slot);
		perSlot.push(m);
	}
	const geometry = mergeGeometries(perSlot, true);
	perSlot.forEach((g) => g.dispose());
	if (!geometry) throw new Error("SmallStall: failed to merge geometry");
	geometry.computeBoundingSphere();
	return { geometry, slots };
}

const bodyCache = new Map<string, Body>();

function getBody(w: number, h: number, d: number, accent: string): Body {
	const textured = stallTextureConfig.enabled;
	const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${accent.toLowerCase()}|${textured ? "t" : "f"}|${stallTextureConfig.normalMaps ? "n" : "no-n"}|${stallTextureConfig.basePath}`;
	let body = bodyCache.get(key);
	if (!body) {
		body = buildBody(w, h, d, accent, textured);
		bodyCache.set(key, body);
	}
	return body;
}

// Call when small stalls are unloaded: frees geometry, materials and textures.
export function disposeSmallStallCaches() {
	cacheEpoch++; // any load still in flight is discarded when it finishes
	pendingLoads.clear();
	bodyCache.forEach((b) => b.geometry.dispose());
	bodyCache.clear();
	materialCache.forEach((m) => m.dispose());
	materialCache.clear();
	textureCache.forEach((t) => t.dispose());
	textureCache.clear();
}

export const buildSmallStallGeometry = getBody;

// ---------------------------------------------------------------------------
// Fascia sign (stall ID drawn on a small canvas texture)
// ---------------------------------------------------------------------------

function createLabelTexture(text: string) {
	if (typeof document === "undefined") return null;
	const canvas = document.createElement("canvas");
	// UI: 2x resolution (4:1 like the sign plane) so the ID stays sharp up close.
	canvas.width = 1024;
	canvas.height = 256;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;

	ctx.fillStyle = C.frame;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	let fontSize = 160;
	const font = (size: number) =>
		`700 ${size}px system-ui, "Segoe UI", Arial, sans-serif`;
	ctx.font = font(fontSize);
	const measured = ctx.measureText(text).width;
	const maxW = canvas.width * 0.9;
	if (measured > maxW) {
		fontSize = Math.floor((fontSize * maxW) / measured);
		ctx.font = font(fontSize);
	}
	ctx.fillStyle = C.dark;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, canvas.width / 2, canvas.height / 2 + fontSize * 0.04);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

// FIX: the texture used to be created inside useMemo. In React Strict Mode the
// first (discarded) render created a texture that was never disposed. Creating it
// in an effect means only a committed texture exists, and it is always disposed.
function useLabelTexture(text: string) {
	const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
	useEffect(() => {
		const t = createLabelTexture(text);
		setTexture(t);
		return () => {
			t?.dispose();
		};
	}, [text]);
	return texture;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// FIX: a missing or NaN size entry used to produce NaN geometry.
const dim = (value: number | undefined, min: number) =>
	Number.isFinite(value) ? Math.max(value as number, min) : min;

export default function SmallStall({
	stall,
	rotationY,
	size,
	color,
}: StallVisualProps) {
	const w = dim(size[0], MIN_W);
	const h = dim(size[1], MIN_H);
	const d = dim(size[2], MIN_D);
	const accent = color || DEFAULT_ACCENT;

	const body = useMemo(() => getBody(w, h, d, accent), [w, h, d, accent]);
	const materials = useMemo(() => body.slots.map(getSlotMaterial), [body]);
	const labelTexture = useLabelTexture(stall.id);

	const { zIn, brandY, fasciaH, cx, cz, cd } = computeLayout(w, h, d);
	const { signW, signH } = signSize(w, h);
	const innerW = w - 2 * BEAM;
	const canopyDepth = Math.max(0.5, d - 2 * BEAM - 0.04);
	const stallLightY = h - BEAM / 2 - 0.07 - 0.08;
	// Kept for the commented-out point lights below.
	const stallLightPositions: [number, number, number][] = [
		[-0.25 * innerW, stallLightY, -0.24 * canopyDepth],
		[0.25 * innerW, stallLightY, -0.24 * canopyDepth],
		[-0.25 * innerW, stallLightY, 0.24 * canopyDepth],
		[0.25 * innerW, stallLightY, 0.24 * canopyDepth],
	];

	return (
		<group name={`stall-${stall.id}`} rotation={[0, rotationY, 0]}>
			{/* Stall body: one mesh, one material per slot (flat / wall / floor / counter) */}
			<mesh geometry={body.geometry} material={materials} />

			{/* Real downlights aligned with the four ceiling light panels. */}
			{/* {stallLightPositions.map((position, index) => (
				<pointLight
					key={`stall-light-${index}`}
					color="#FFF3C4"
					position={position}
					intensity={0.45}
					distance={4.5}
					decay={2}
					castShadow={false}
				/>
			))} */}

			{/* Stall ID sign on the fascia */}
			{labelTexture && (
				<mesh
					geometry={UNIT_PLANE}
					position={[0, h - fasciaH / 2, d / 2 + 0.002]}
					scale={[signW, signH, 1]}
				>
					<meshBasicMaterial map={labelTexture} toneMapped={false} />
				</mesh>
			)}

			{/* FIX: Suspense so the stall appears immediately while the receptionist model
			    loads, instead of suspending the whole canvas. Position follows the counter
			    (x = counter centre, behind the counter) rather than a fixed [0.8, 1, 1.7],
			    which was outside the stall for depths under about 3.4 m. */}
			<Suspense fallback={null}>
				<ReceptionistModel
					position={[
						cx,
						RECEPTIONIST_Y,
						cz - cd / 2 - RECEPTIONIST_GAP,
					]}
					rotation={[0, 0, 0]}
					scale={0.85}
				/>
			</Suspense>

			{/* Attachment points: logo placement, player interaction spot */}
			<group name="anchor_logo" position={[0, brandY, zIn + 0.045]} />
			<group name="anchor_interact" position={[0, 0, d / 2 + 0.9]} />
		</group>
	);
}
