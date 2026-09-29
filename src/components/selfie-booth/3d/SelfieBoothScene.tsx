"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import SelfieBoothModel from "./SelfieBoothModel";

import { createCarpetTexture } from "@/utils/textureGenerator";
import { useSelfieCamera } from "./UserSelfieCamera";

interface SelfieBoothSceneProps {
	onCapture: (photo: Blob) => void;
	onRetake: () => void;
	capturedPhoto?: Blob | null;
}

/* ---------------------------------------------------------------------- */
/* Booth Environment (unchanged)                                           */
/* ---------------------------------------------------------------------- */

function BoothEnvironment() {
	const carpetTexture = useMemo(() => createCarpetTexture(), []);

	useEffect(() => {
		return () => {
			carpetTexture.dispose();
		};
	}, [carpetTexture]);

	return (
		<group>
			<mesh position={[0, 5, -4.8]}>
				<boxGeometry args={[30, 14, 0.25]} />
				<meshStandardMaterial color="#f3f0eb" roughness={0.92} />
			</mesh>

			<mesh position={[0, -0.55, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[30, 30]} />
				<meshStandardMaterial
					map={carpetTexture}
					color="#ffffff"
					roughness={0.88}
				/>
			</mesh>
		</group>
	);
}

/* ---------------------------------------------------------------------- */
/* Plants (unchanged)                                                      */
/* ---------------------------------------------------------------------- */

function BoothPlants() {
	const { scene } = useThree();

	useEffect(() => {
		let cancelled = false;
		let plantRoot: THREE.Group | null = null;

		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath("/draco/");

		const loader = new GLTFLoader();
		loader.setDRACOLoader(dracoLoader);
		loader.setMeshoptDecoder(MeshoptDecoder);

		loader.load(
			"/models/plant-final.glb",
			(gltf) => {
				if (cancelled) return;

				const source = gltf.scene;
				const positions: Array<[number, number, number]> = [
					[-6.75, 1.55, -1.8],
					[6.75, 1.55, -1.8],
				];

				plantRoot = new THREE.Group();
				plantRoot.name = "SelfieBoothPlants";

				positions.forEach(([x, y, z], index) => {
					const plant = source.clone(true);

					plant.name = `SelfieBoothPlant_${index}`;
					plant.position.set(x, y, z);
					plant.scale.setScalar(3.25);
					plant.rotation.y = 0;

					plant.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							child.castShadow = false;
							child.receiveShadow = false;

							child.material = Array.isArray(child.material)
								? child.material.map((m) => m.clone())
								: child.material.clone();
						}
					});

					plantRoot!.add(plant);
				});

				scene.add(plantRoot);
			},
			undefined,
			(error) => {
				console.error("SELFIE BOOTH PLANT GLB FAILED TO LOAD:", error);
			},
		);

		return () => {
			cancelled = true;

			if (plantRoot) {
				scene.remove(plantRoot);

				plantRoot.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						if (Array.isArray(child.material)) {
							child.material.forEach((m) => m.dispose());
						} else {
							child.material.dispose();
						}
					}
				});
			}

			dracoLoader.dispose();
		};
	}, [scene]);

	return null;
}

/* ---------------------------------------------------------------------- */
/* Responsive fit: keep the whole booth visible on any aspect ratio        */
/* ---------------------------------------------------------------------- */

function ResponsiveFit() {
	const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
	const size = useThree((state) => state.size);

	useEffect(() => {
		const aspect = size.width / size.height;

		/*
		 * At camera distance ~15.5 and fov 38 the visible height is ~10.7.
		 * Fit the booth's 9.9 unit body plus a small margin on narrow screens.
		 */
		camera.zoom = Math.min(1, 10.7 / 10.2, (10.7 * aspect) / 10.6);
		camera.updateProjectionMatrix();
	}, [camera, size.width, size.height]);

	return null;
}

/* Draws the live camera + template into the canvas texture every frame */
function CameraFrameLoop({ onFrame }: { onFrame: () => void }) {
	useFrame(() => {
		onFrame();
	});

	return null;
}

/* ---------------------------------------------------------------------- */
/* Scene                                                                   */
/* ---------------------------------------------------------------------- */

export default function SelfieBoothScene({
	onCapture,
	onRetake,
	capturedPhoto = null,
}: SelfieBoothSceneProps) {
	const { phase, error, texture, start, capture, drawFrame } =
		useSelfieCamera();

	const handleStart = useCallback(async () => {
		await start();
	}, [start]);

	const handleCapture = useCallback(async () => {
		const blob = await capture();

		if (blob) {
			onCapture(blob);
		}
	}, [capture, onCapture]);

	/* Retake: parent clears the photo -> restart the camera */
	const hadPhotoRef = useRef(false);

	useEffect(() => {
		if (capturedPhoto) {
			hadPhotoRef.current = true;
			return;
		}

		if (hadPhotoRef.current && phase === "captured") {
			hadPhotoRef.current = false;
			void start();
		}
	}, [capturedPhoto, phase, start]);

	return (
		<div className="absolute inset-0 min-h-[100svh] w-full overflow-hidden">
			<Canvas
				dpr={[1, 1.25]}
				camera={{
					position: [0, 4.45, 15.5],
					fov: 38,
					near: 0.1,
					far: 100,
				}}
				gl={{
					antialias: true,
					powerPreference: "high-performance",
				}}
			>
				<color attach="background" args={["#f1eeea"]} />

				<ambientLight intensity={0.85} />

				<directionalLight
					position={[5, 9, 7]}
					intensity={1.65}
					color="#fff4e8"
				/>

				<directionalLight
					position={[-5, 6, 5]}
					intensity={0.8}
					color="#ffffff"
				/>

				<pointLight
					position={[0, 4.5, 4]}
					intensity={1.0}
					color="#fff1df"
					distance={12}
				/>

				<pointLight
					position={[0, 5, 1]}
					intensity={0.8}
					color="#fff8ee"
					distance={8}
				/>

				<Environment preset="lobby" background={false} />

				<ResponsiveFit />

				<CameraFrameLoop onFrame={drawFrame} />

				<BoothEnvironment />

				<BoothPlants />

				<SelfieBoothModel
					onAction={() => {
						if (phase === "idle") {
							void handleStart();
						} else if (phase === "live") {
							void handleCapture();
						} else if (phase === "captured") {
							onRetake();
						}
					}}
					actionLabel={
						phase === "starting"
							? "STARTING CAMERA..."
							: phase === "live"
								? "CAPTURE SELFIE"
								: phase === "captured"
									? "RETAKE SELFIE"
									: "TAKE SELFIE"
					}
					actionDisabled={phase === "starting"}
					cameraTexture={
						phase === "live" || phase === "captured"
							? texture
							: null
					}
				/>

				<OrbitControls
					enablePan={false}
					enableZoom={false}
					enableRotate={false}
					minAzimuthAngle={-Math.PI / 12}
					maxAzimuthAngle={Math.PI / 12}
					minPolarAngle={Math.PI / 2.15}
					maxPolarAngle={Math.PI / 2.15}
					target={[0, 4.0, 0]}
					enableDamping
					dampingFactor={0.08}
				/>
			</Canvas>

			{/* ERROR + RETRY */}
			{error && phase === "idle" && (
				<div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4">
					<div className="pointer-events-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-red-200 bg-white/95 p-4 text-center shadow-xl">
						<p className="text-sm font-medium text-slate-800">
							{error}
						</p>

						<button
							onClick={() => {
								void handleStart();
							}}
							className="rounded-full bg-[#123b78] px-6 py-2 text-xs font-bold tracking-wide text-white transition hover:scale-105 active:scale-95"
						>
							TRY AGAIN
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
