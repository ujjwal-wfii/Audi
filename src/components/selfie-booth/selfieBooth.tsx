"use client";

import { useEffect, useState } from "react";

import SelfieBoothScene from "./3d/SelfieBoothScene";

export default function SelfieBooth() {
	const [started, setStarted] = useState(false);
	const [photo, setPhoto] = useState<Blob | null>(null);
	const [photoUrl, setPhotoUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!photo) {
			setPhotoUrl(null);
			return;
		}

		const url = URL.createObjectURL(photo);
		setPhotoUrl(url);

		return () => {
			URL.revokeObjectURL(url);
		};
	}, [photo]);

	function handleStartCamera() {
		setStarted(true);
	}

	function handleCapture(capturedPhoto: Blob) {
		setPhoto(capturedPhoto);
	}

	function handleRetake() {
		setPhoto(null);
	}

	function handleContinue() {
		/*
		 * The captured photo already includes the mirrored image and the
		 * OPEXN frame. Next: development animation / final result.
		 */
		console.log("Continue with selfie:", photoUrl);
	}

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#f1eeea]">
			<SelfieBoothScene
				onTakeSelfie={handleStartCamera}
				onCapture={handleCapture}
				showTakeSelfie={!started}
				capturedPhoto={photo}
			/>

			{photo && (
				<div className="pointer-events-none absolute inset-x-0 bottom-[7%] z-40 flex justify-center px-4 sm:bottom-[6%]">
					<div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/10 p-2 backdrop-blur-sm">
						<button
							onClick={handleRetake}
							className="rounded-full border border-white/80 bg-white px-6 py-3 text-xs font-bold tracking-wide text-slate-900 shadow-lg transition duration-200 hover:scale-105 active:scale-95 sm:px-7 sm:text-sm"
						>
							RETAKE
						</button>

						<button
							onClick={handleContinue}
							className="rounded-full bg-[#123b78] px-7 py-3 text-xs font-bold tracking-wide text-white shadow-lg transition duration-200 hover:scale-105 active:scale-95 sm:px-8 sm:text-sm"
						>
							CONTINUE
						</button>
					</div>
				</div>
			)}
		</main>
	);
}
