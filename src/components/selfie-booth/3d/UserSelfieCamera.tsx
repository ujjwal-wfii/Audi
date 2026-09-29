// "use client";

// import { useCallback, useEffect, useRef, useState } from "react";
// import * as THREE from "three";

// export type CameraPhase = "idle" | "starting" | "live" | "captured";

// /* 1184 / 984 = booth screen 5.92 / 4.92 */
// const CANVAS_WIDTH = 1184;
// const CANVAS_HEIGHT = 984;

// function describeError(error: unknown): string {
// 	const name = (error as { name?: string })?.name;

// 	if (name === "NotAllowedError" || name === "SecurityError") {
// 		return "Camera access was denied. Please allow camera permission in your browser and try again.";
// 	}
// 	if (name === "NotFoundError" || name === "OverconstrainedError") {
// 		return "No camera was found on this device.";
// 	}
// 	if (name === "NotReadableError") {
// 		return "Your camera is being used by another app. Close it and try again.";
// 	}
// 	return "We couldn't start the camera. Please try again.";
// }

// export function useSelfieCamera() {
// 	const [phase, setPhaseState] = useState<CameraPhase>("idle");
// 	const [error, setError] = useState<string | null>(null);
// 	const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

// 	const phaseRef = useRef<CameraPhase>("idle");
// 	const canvasRef = useRef<HTMLCanvasElement | null>(null);
// 	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
// 	const textureRef = useRef<THREE.CanvasTexture | null>(null);
// 	const videoRef = useRef<HTMLVideoElement | null>(null);
// 	const streamRef = useRef<MediaStream | null>(null);
// 	const startingRef = useRef(false);
// 	const mountedRef = useRef(false);

// 	const setPhase = useCallback((next: CameraPhase) => {
// 		phaseRef.current = next;
// 		setPhaseState(next);
// 	}, []);

// 	const stopStream = useCallback(() => {
// 		streamRef.current?.getTracks().forEach((track) => track.stop());
// 		streamRef.current = null;

// 		if (videoRef.current) {
// 			videoRef.current.pause();
// 			videoRef.current.srcObject = null;
// 			videoRef.current = null;
// 		}
// 	}, []);

// 	/* Create the composite canvas + texture once (client only) */
// 	useEffect(() => {
// 		mountedRef.current = true;

// 		const canvas = document.createElement("canvas");
// 		canvas.width = CANVAS_WIDTH;
// 		canvas.height = CANVAS_HEIGHT;

// 		const ctx = canvas.getContext("2d");
// 		if (ctx) {
// 			ctx.fillStyle = "#101a2a";
// 			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
// 		}

// 		const canvasTexture = new THREE.CanvasTexture(canvas);
// 		canvasTexture.colorSpace = THREE.SRGBColorSpace;
// 		canvasTexture.minFilter = THREE.LinearFilter;
// 		canvasTexture.magFilter = THREE.LinearFilter;
// 		canvasTexture.generateMipmaps = false;

// 		canvasRef.current = canvas;
// 		ctxRef.current = ctx;
// 		textureRef.current = canvasTexture;
// 		setTexture(canvasTexture);

// 		return () => {
// 			mountedRef.current = false;
// 			stopStream();
// 			canvasTexture.dispose();
// 			textureRef.current = null;
// 			canvasRef.current = null;
// 			ctxRef.current = null;
// 		};
// 	}, [stopStream]);

// 	/* Draw one frame: mirrored + cover-cropped video, then template overlay */
// 	const drawFrame = useCallback(() => {
// 		if (phaseRef.current !== "live") return;

// 		const canvas = canvasRef.current;
// 		const ctx = ctxRef.current;
// 		const video = videoRef.current;
// 		const tex = textureRef.current;

// 		if (!canvas || !ctx || !video || !tex) return;
// 		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

// 		const vw = video.videoWidth;
// 		const vh = video.videoHeight;
// 		if (!vw || !vh) return;

// 		const targetAspect = canvas.width / canvas.height;
// 		const videoAspect = vw / vh;

// 		let sw = vw;
// 		let sh = vh;
// 		let sx = 0;
// 		let sy = 0;

// 		if (videoAspect > targetAspect) {
// 			sw = vh * targetAspect;
// 			sx = (vw - sw) / 2;
// 		} else {
// 			sh = vw / targetAspect;
// 			sy = (vh - sh) / 2;
// 		}

// 		ctx.clearRect(0, 0, canvas.width, canvas.height);

// 		ctx.save();
// 		ctx.beginPath();
// 		ctx.roundRect(0, 0, canvas.width, canvas.height, 58);
// 		ctx.clip();
// 		ctx.fillStyle = "#101a2a";
// 		ctx.fillRect(0, 0, canvas.width, canvas.height);
// 		ctx.translate(canvas.width, 0);
// 		ctx.scale(-1, 1); // mirror like a normal selfie camera
// 		ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
// 		ctx.restore();

// 		tex.needsUpdate = true;
// 	}, []);

// 	const start = useCallback(async (): Promise<boolean> => {
// 		if (startingRef.current || streamRef.current) return false;

// 		startingRef.current = true;
// 		setError(null);
// 		setPhase("starting");

// 		let stream: MediaStream | null = null;

// 		try {
// 			if (!navigator.mediaDevices?.getUserMedia) {
// 				throw new Error("Camera API is not supported by this browser.");
// 			}

// 			stream = await navigator.mediaDevices.getUserMedia({
// 				video: {
// 					facingMode: "user",
// 					width: { ideal: 1280 },
// 					height: { ideal: 720 },
// 				},
// 				audio: false,
// 			});

// 			const video = document.createElement("video");
// 			video.srcObject = stream;
// 			video.muted = true;
// 			video.playsInline = true;
// 			video.autoplay = true;

// 			await video.play();

// 			if (!mountedRef.current) {
// 				stream.getTracks().forEach((track) => track.stop());
// 				return false;
// 			}

// 			videoRef.current = video;
// 			streamRef.current = stream;
// 			setPhase("live");

// 			return true;
// 		} catch (err) {
// 			console.error("Camera start failed:", err);
// 			stream?.getTracks().forEach((track) => track.stop());
// 			streamRef.current = null;
// 			videoRef.current = null;

// 			if (mountedRef.current) {
// 				setError(describeError(err));
// 				setPhase("idle");
// 			}
// 			return false;
// 		} finally {
// 			startingRef.current = false;
// 		}
// 	}, [setPhase]);

// 	/* Export exactly what the user sees (mirrored + template baked in) */
// 	const capture = useCallback((): Promise<Blob | null> => {
// 		return new Promise((resolve) => {
// 			const canvas = canvasRef.current;

// 			if (phaseRef.current !== "live" || !canvas) {
// 				resolve(null);
// 				return;
// 			}

// 			drawFrame();

// 			canvas.toBlob(
// 				(blob) => {
// 					if (!blob) {
// 						resolve(null);
// 						return;
// 					}

// 					// Freeze: last frame stays on the canvas texture
// 					stopStream();
// 					setPhase("captured");
// 					resolve(blob);
// 				},
// 				"image/jpeg",
// 				0.92,
// 			);
// 		});
// 	}, [drawFrame, setPhase, stopStream]);

// 	return { phase, error, texture, start, capture, drawFrame };
// }

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { getSegmenter, segmentAndPaintMask } from "./SelfieSegmenter";
import { getBoothBackgroundCanvas } from "./BackgroundTexture";

export type CameraPhase = "idle" | "starting" | "live" | "captured";

/* 1200 / 1000 = 1.2 ≈ booth screen 5.92 / 4.92 */
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 1000;

/* Segmentation runs on a small downscaled copy, and only every Nth frame */
const SEGMENT_INPUT_WIDTH = 320;
const SEGMENT_INPUT_HEIGHT = Math.round(
	(SEGMENT_INPUT_WIDTH * CANVAS_HEIGHT) / CANVAS_WIDTH,
);
const SEGMENT_EVERY_N_FRAMES = 2;

function describeError(error: unknown): string {
	const name = (error as { name?: string })?.name;

	if (name === "NotAllowedError" || name === "SecurityError") {
		return "Camera access was denied. Please allow camera permission in your browser and try again.";
	}
	if (name === "NotFoundError" || name === "OverconstrainedError") {
		return "No camera was found on this device.";
	}
	if (name === "NotReadableError") {
		return "Your camera is being used by another app. Close it and try again.";
	}
	return "We couldn't start the camera. Please try again.";
}

export function useSelfieCamera() {
	const [phase, setPhaseState] = useState<CameraPhase>("idle");
	const [error, setError] = useState<string | null>(null);
	const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

	const phaseRef = useRef<CameraPhase>("idle");
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	const textureRef = useRef<THREE.CanvasTexture | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const startingRef = useRef(false);
	const mountedRef = useRef(false);

	/* Background removal pipeline */
	const segmenterRef = useRef<ImageSegmenter | null>(null);
	const segmentationEnabledRef = useRef(true); // flips false permanently on any failure
	const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const personCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const frameCounterRef = useRef(0);

	const setPhase = useCallback((next: CameraPhase) => {
		phaseRef.current = next;
		setPhaseState(next);
	}, []);

	const stopStream = useCallback(() => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;

		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.srcObject = null;
			videoRef.current = null;
		}
	}, []);

	/* Create canvases + texture once (client only), and lazily load the segmenter */
	useEffect(() => {
		mountedRef.current = true;

		const canvas = document.createElement("canvas");
		canvas.width = CANVAS_WIDTH;
		canvas.height = CANVAS_HEIGHT;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#101a2a";
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		}

		const canvasTexture = new THREE.CanvasTexture(canvas);
		canvasTexture.colorSpace = THREE.SRGBColorSpace;
		canvasTexture.minFilter = THREE.LinearFilter;
		canvasTexture.magFilter = THREE.LinearFilter;
		canvasTexture.generateMipmaps = false;

		canvasRef.current = canvas;
		ctxRef.current = ctx;
		textureRef.current = canvasTexture;
		setTexture(canvasTexture);

		const small = document.createElement("canvas");
		small.width = SEGMENT_INPUT_WIDTH;
		small.height = SEGMENT_INPUT_HEIGHT;
		smallCanvasRef.current = small;

		const mask = document.createElement("canvas");
		mask.width = CANVAS_WIDTH;
		mask.height = CANVAS_HEIGHT;
		maskCanvasRef.current = mask;

		const person = document.createElement("canvas");
		person.width = CANVAS_WIDTH;
		person.height = CANVAS_HEIGHT;
		personCanvasRef.current = person;

		getSegmenter()
			.then((segmenter) => {
				if (!mountedRef.current) {
					segmenter?.close();
					return;
				}
				if (!segmenter) {
					segmentationEnabledRef.current = false;
					return;
				}
				segmenterRef.current = segmenter;
			})
			.catch(() => {
				segmentationEnabledRef.current = false;
			});

		return () => {
			mountedRef.current = false;
			stopStream();
			canvasTexture.dispose();
			textureRef.current = null;
			canvasRef.current = null;
			ctxRef.current = null;
			segmenterRef.current?.close();
			segmenterRef.current = null;
		};
	}, [stopStream]);

	/* Draw one frame: booth background + person cut out on top (or plain video if unavailable) */
	const drawFrame = useCallback(() => {
		if (phaseRef.current !== "live") return;

		const canvas = canvasRef.current;
		const ctx = ctxRef.current;
		const video = videoRef.current;
		const tex = textureRef.current;

		if (!canvas || !ctx || !video || !tex) return;
		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return;

		const targetAspect = canvas.width / canvas.height;
		const videoAspect = vw / vh;

		let sw = vw;
		let sh = vh;
		let sx = 0;
		let sy = 0;

		if (videoAspect > targetAspect) {
			sw = vh * targetAspect;
			sx = (vw - sw) / 2;
		} else {
			sh = vw / targetAspect;
			sy = (vh - sh) / 2;
		}

		const canUseSegmentation =
			segmentationEnabledRef.current &&
			segmenterRef.current &&
			personCanvasRef.current &&
			maskCanvasRef.current;

		if (!canUseSegmentation) {
			// Fallback: plain mirrored camera feed, no background swap.
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			ctx.translate(canvas.width, 0);
			ctx.scale(-1, 1);
			ctx.drawImage(
				video,
				sx,
				sy,
				sw,
				sh,
				0,
				0,
				canvas.width,
				canvas.height,
			);
			ctx.restore();
			tex.needsUpdate = true;
			return;
		}

		const personCanvas = personCanvasRef.current!;
		const maskCanvas = maskCanvasRef.current!;
		const personCtx = personCanvas.getContext("2d");
		if (!personCtx) return;

		// 1. Draw the mirrored, cropped person onto the person layer (full res).
		personCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
		personCtx.save();
		personCtx.translate(personCanvas.width, 0);
		personCtx.scale(-1, 1);
		personCtx.drawImage(
			video,
			sx,
			sy,
			sw,
			sh,
			0,
			0,
			personCanvas.width,
			personCanvas.height,
		);
		personCtx.restore();

		// 2. Throttled inference: feed a small MIRRORED+cropped copy so the
		//    resulting mask is already in the same orientation as the person
		//    layer above — no extra flips needed when compositing.
		frameCounterRef.current += 1;
		const shouldInfer =
			frameCounterRef.current % SEGMENT_EVERY_N_FRAMES === 0;

		if (shouldInfer) {
			const small = smallCanvasRef.current;
			const smallCtx = small?.getContext("2d");

			if (small && smallCtx) {
				smallCtx.save();
				smallCtx.translate(small.width, 0);
				smallCtx.scale(-1, 1);
				smallCtx.drawImage(
					video,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					small.width,
					small.height,
				);
				smallCtx.restore();

				try {
					segmentAndPaintMask(
						segmenterRef.current!,
						small,
						performance.now(),
						maskCanvas,
					);
				} catch (err) {
					console.error(
						"Segmentation failed, disabling background removal:",
						err,
					);
					segmentationEnabledRef.current = false;
				}
			}
		}

		// 3. Cut the person layer down to just the masked (foreground) pixels.
		personCtx.globalCompositeOperation = "destination-in";
		personCtx.drawImage(maskCanvas, 0, 0);
		personCtx.globalCompositeOperation = "source-over";

		// 4. Composite: booth background first, person on top.
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(
			getBoothBackgroundCanvas(),
			0,
			0,
			canvas.width,
			canvas.height,
		);
		ctx.drawImage(personCanvas, 0, 0);

		tex.needsUpdate = true;
	}, []);

	const start = useCallback(async (): Promise<boolean> => {
		if (startingRef.current || streamRef.current) return false;

		startingRef.current = true;
		setError(null);
		setPhase("starting");

		let stream: MediaStream | null = null;

		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error("Camera API is not supported by this browser.");
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
				audio: false,
			});

			const video = document.createElement("video");
			video.srcObject = stream;
			video.muted = true;
			video.playsInline = true;
			video.autoplay = true;

			await video.play();

			if (!mountedRef.current) {
				stream.getTracks().forEach((track) => track.stop());
				return false;
			}

			videoRef.current = video;
			streamRef.current = stream;
			frameCounterRef.current = 0;
			setPhase("live");

			return true;
		} catch (err) {
			console.error("Camera start failed:", err);
			stream?.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
			videoRef.current = null;

			if (mountedRef.current) {
				setError(describeError(err));
				setPhase("idle");
			}
			return false;
		} finally {
			startingRef.current = false;
		}
	}, [setPhase]);

	/* Export exactly what the user sees (mirrored, background-swapped) */
	const capture = useCallback((): Promise<Blob | null> => {
		return new Promise((resolve) => {
			const canvas = canvasRef.current;

			if (phaseRef.current !== "live" || !canvas) {
				resolve(null);
				return;
			}

			drawFrame();

			canvas.toBlob(
				(blob) => {
					if (!blob) {
						resolve(null);
						return;
					}

					stopStream();
					setPhase("captured");
					resolve(blob);
				},
				"image/jpeg",
				0.92,
			);
		});
	}, [drawFrame, setPhase, stopStream]);

	return { phase, error, texture, start, capture, drawFrame };
}
