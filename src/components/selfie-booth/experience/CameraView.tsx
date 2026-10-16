"use client";

import { useEffect, useRef, useState } from "react";

import {
	captureFrame,
	startCamera,
	stopCamera,
} from "@/lib/selfie-booth/camera";

interface CameraViewProps {
	onCapture: (photo: Blob) => void;
}

export default function CameraView({ onCapture }: CameraViewProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [capturing, setCapturing] = useState(false);

	useEffect(() => {
		let mounted = true;

		async function initializeCamera() {
			const video = videoRef.current;

			if (!video) return;

			try {
				const stream = await startCamera(video);

				if (!mounted) {
					stopCamera(stream);
					return;
				}

				streamRef.current = stream;

				video.muted = true;
				video.playsInline = true;

				if (video.paused) {
					await video.play();
				}

				if (!mounted) {
					stopCamera(stream);
					return;
				}

				setReady(true);
			} catch (error) {
				if (!mounted) return;

				console.error("Camera initialization failed:", error);

				if (
					error instanceof DOMException &&
					error.name === "NotAllowedError"
				) {
					setError("Camera permission was denied.");
				} else {
					setError("Unable to access your camera.");
				}
			}
		}

		initializeCamera();

		return () => {
			mounted = false;

			stopCamera(streamRef.current);
			streamRef.current = null;

			if (videoRef.current) {
				videoRef.current.pause();
				videoRef.current.srcObject = null;
			}
		};
	}, []);

	async function handleCapture() {
		const video = videoRef.current;

		if (!video || !ready || capturing) {
			return;
		}

		try {
			setCapturing(true);

			const photo = await captureFrame(video);

			onCapture(photo);
		} catch (error) {
			console.error("Photo capture failed:", error);

			setCapturing(false);
		}
	}

	return (
		<>
			{/* CAMERA SCREEN */}
			<div
				className="
					absolute
					left-1/2
					top-[24%]
					z-30
					aspect-[1.2/1]
					w-[32%]
					-translate-x-1/2
					overflow-hidden
					rounded-[28px]
					bg-black
					shadow-inner

					max-[900px]:top-[26%]
					max-[900px]:w-[42%]

					max-[640px]:top-[28%]
					max-[640px]:w-[62%]
				"
			>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className="
						h-full
						w-full
						object-cover
						[transform:scaleX(-1)]
					"
				/>

				{/* Camera loading */}
				{!ready && !error && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/50">
						<p className="text-sm text-white">Starting camera...</p>
					</div>
				)}

				{/* Permission error */}
				{error && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/80 p-5 text-center">
						<p className="text-sm text-white">
							{error}
							<br />
							<span className="mt-2 block text-xs text-white/60">
								Please allow camera access in your browser.
							</span>
						</p>
					</div>
				)}
			</div>

			{/* CAPTURE BUTTON */}
			{ready && !error && (
				<div
					className="
						pointer-events-auto
						absolute
						bottom-[12%]
						left-1/2
						z-40
						-translate-x-1/2
					"
				>
					<button
						onClick={handleCapture}
						disabled={capturing}
						className="
							rounded-full
							bg-white
							px-8
							py-3
							text-sm
							font-bold
							tracking-wide
							text-slate-900
							shadow-2xl
							transition
							hover:scale-105
							active:scale-95
							disabled:opacity-60
						"
					>
						{capturing ? "CAPTURING..." : "CAPTURE"}
					</button>
				</div>
			)}
		</>
	);
}
