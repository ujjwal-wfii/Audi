"use client";

import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface ReceptionistModelProps {
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

export default function ReceptionistModel({
	position = [0, 0, 0],
	rotation = [0, 0, 0],
	scale = 1,
}: ReceptionistModelProps) {
	const { scene } = useGLTF(
		"/models/exhibition/receptionist-draco.glb",
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

useGLTF.preload("/models/exhibition/receptionist-draco.glb", "/draco/");
