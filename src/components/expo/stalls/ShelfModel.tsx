"use client";

import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface ShelfModelProps {
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

export default function ShelfModel({
	position = [0, 0, 0],
	rotation = [0, 0, 0],
	scale = 1,
}: ShelfModelProps) {
	const { scene } = useGLTF(
		"/models/exhibition/3tier-shelf-draco.glb",
		"/draco/",
	);

	return (
		<primitive
			object={scene.clone(true)}
			position={position}
			rotation={rotation}
			scale={scale}
		/>
	);
}

useGLTF.preload("/models/exhibition/3tier-shelf-draco.glb", "/draco/");
