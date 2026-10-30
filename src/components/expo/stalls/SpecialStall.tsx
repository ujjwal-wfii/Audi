import { RoundedBox, Text, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { StallVisualProps } from "./stallTypes";

export default function SpecialStall({
	stall,
	rotationY,
	size,
	color,
}: StallVisualProps) {
	const [width, height, depth] = size;
	const wallHeight = 3.8;
	const frontZ = depth / 2;
	const backZ = -depth / 2;
	const leftX = -width / 2;
	const rightX = width / 2;
	// const tableTexture = useTexture(
	// 	"/textures/silver_oak_veneer_02_diff_1k.jpg",
	// );
	// const bumpTexture = useTexture("/textures/silver_oak_veneer_02_disp_1k.png");
	// const woodTexture = useMemo(() => {
	// 	const texture = tableTexture.clone();
	// 	const bump = bumpTexture.clone();
	// 	texture.wrapS = THREE.RepeatWrapping;
	// 	texture.wrapT = THREE.RepeatWrapping;
	// 	texture.repeat.set(1.8, 1);
	// 	texture.colorSpace = THREE.SRGBColorSpace;
	// 	bump.wrapS = THREE.RepeatWrapping;
	// 	bump.wrapT = THREE.RepeatWrapping;
	// 	bump.repeat.set(1.8, 1);
	// 	return { texture, bump };
	// }, [bumpTexture, tableTexture]);

	return (
		<group rotation={[0, rotationY, 0]}>
			{/* Back wall */}
			<mesh position={[0, wallHeight / 2, backZ + 0.25]}>
				<boxGeometry args={[width, wallHeight, 0.1]} />
				<meshStandardMaterial color="#eeeeF0" />
			</mesh>
			{/* Left wall */}
			<mesh position={[leftX + 0.05, wallHeight / 2, 0]}>
				<boxGeometry args={[0.1, wallHeight, depth]} />
				<meshStandardMaterial color="#e4e4e7" />
			</mesh>
			{/* Right wall */}
			<mesh position={[rightX - 0.05, wallHeight / 2, 0]}>
				<boxGeometry args={[0.1, wallHeight, depth]} />
				<meshStandardMaterial color="#e4e4e7" />
			</mesh>
			{/* Front fascia */}
			<mesh
				position={[
					0,
					wallHeight + (height - wallHeight) / 2,
					frontZ - 0.05,
				]}
			>
				<boxGeometry args={[width, height - wallHeight, 0.16]} />
				<meshStandardMaterial color={color} />
			</mesh>
			{/* Back fascia */}
			<mesh
				position={[
					0,
					wallHeight + (height - wallHeight) / 2,
					backZ + 0.25,
				]}
			>
				<boxGeometry args={[width, height - wallHeight, 0.16]} />
				<meshStandardMaterial color={color} />
			</mesh>
			{/* Left fascia */}
			<mesh
				position={[
					leftX + 0.05,
					wallHeight + (height - wallHeight) / 2,
					0,
				]}
			>
				<boxGeometry args={[0.16, height - wallHeight, depth]} />
				<meshStandardMaterial color={color} />
			</mesh>
			{/* Right fascia */}
			<mesh
				position={[
					rightX - 0.05,
					wallHeight + (height - wallHeight) / 2,
					0,
				]}
			>
				<boxGeometry args={[0.16, height - wallHeight, depth]} />
				<meshStandardMaterial color={color} />
			</mesh>
			{/* Reception counter */}
			<mesh position={[0, 0.45, frontZ - 0.35]}>
				<boxGeometry args={[Math.min(4, width - 0.4), 0.84, 0.65]} />
				<meshStandardMaterial
					color="#d3d3d3"
					bumpScale={0.035}
					roughness={0.62}
					metalness={0}
				/>
			</mesh>
			<RoundedBox
				position={[0, 0.91, frontZ - 0.35]}
				args={[Math.min(4.14, width - 0.24), 0.12, 0.76]}
				radius={0.045}
				smoothness={3}
			>
				<meshStandardMaterial
					color="#d3d3d3"
					bumpScale={0.02}
					roughness={0.34}
					metalness={0}
				/>
			</RoundedBox>
			{/* Stall name */}
			<Text
				position={[0, height - 0.35, frontZ + 0.05]}
				fontSize={0.8}
				color="#ffffff"
				anchorX="center"
				anchorY="middle"
			>
				{stall.id}
			</Text>
		</group>
	);
}
