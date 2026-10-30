"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useLayoutEffect, useMemo } from "react";

type HallBounds = {
	min: { x: number; y: number; z: number };
	max: { x: number; y: number; z: number };
	width: number;
	depth: number;
	ceiling_height: number;
	floor_center: number[];
	floor_size: number[];
};

type CeilingProps = {
	hall: HallBounds;
	/**
	 * Width in metres of one texture tile. One tile holds 3 light columns x 3 light
	 * rows, so the default 12 puts the lights 4 m apart across the hall.
	 */
	tileWidth?: number;
	/** 1 = exactly as photographed. Above 1 brightens the dark ceiling. */
	brightness?: number;
};

// Put ceiling_grid.jpg in public/textures/ceiling/
const CEILING_URL = "/textures/ceiling/ceiling_grid.jpg";

// The tile is 1122 x 566 px. Keeping this ratio stops the pattern being stretched.
const TILE_ASPECT = 566 / 1122;

export default function Ceiling({
	hall,
	tileWidth = 12,
	brightness = 1,
}: CeilingProps) {
	const texture = useTexture(CEILING_URL);

	useLayoutEffect(() => {
		const tileDepth = tileWidth * TILE_ASPECT;
		// The image was cropped so its opposite edges line up, so plain
		// RepeatWrapping is seamless and keeps the light grid evenly spaced.
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(hall.width / tileWidth, hall.depth / tileDepth);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 16; // clamped to what the GPU supports
		texture.needsUpdate = true;
	}, [texture, hall.width, hall.depth, tileWidth]);

	const tint = useMemo(
		() => new THREE.Color(brightness, brightness, brightness),
		[brightness],
	);

	return (
		<mesh
			name="ExhibitionHallCeiling"
			// +90 degrees about X turns the plane's front face to point down
			rotation={[Math.PI / 2, 0, 0]}
			position={[
				hall.min.x + hall.width / 2,
				hall.ceiling_height,
				hall.min.z + hall.depth / 2,
			]}
			raycast={() => null}
		>
			<planeGeometry args={[hall.width, hall.depth]} />
			{/* Unlit: the photo already contains its own lighting, and a lit
			    material would turn this very dark image nearly black. */}
			<meshBasicMaterial map={texture} color={tint} toneMapped={false} />
		</mesh>
	);
}

useTexture.preload(CEILING_URL);
