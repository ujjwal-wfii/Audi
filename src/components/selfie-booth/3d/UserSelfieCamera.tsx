"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type CameraPhase = "idle" | "starting" | "live" | "captured";

/* 1200 / 1000 = 1.2 ≈ booth screen 5.92 / 4.92 */
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 1000;

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

	/* Create the composite canvas + texture once (client only) */
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

		return () => {
			mountedRef.current = false;
			stopStream();
			canvasTexture.dispose();
			textureRef.current = null;
			canvasRef.current = null;
			ctxRef.current = null;
		};
	}, [stopStream]);

	/* Draw one frame: mirrored + cover-cropped video, then template overlay */
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

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.save();
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1); // mirror like a normal selfie camera
		ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
		ctx.restore();

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

	/* Export exactly what the user sees (mirrored + template baked in) */
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

					// Freeze: last frame stays on the canvas texture
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
