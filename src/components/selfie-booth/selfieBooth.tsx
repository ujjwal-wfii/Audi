"use client";

import { useEffect, useState } from "react";

import SelfieBoothScene from "./3d/SelfieBoothScene";

export default function SelfieBooth() {
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

	function handleCapture(capturedPhoto: Blob) {
		setPhoto(capturedPhoto);
	}

	function handleRetake() {
		setPhoto(null);
	}

	function handleContinue() {
		/*
		 * The captured photo is mirrored camera output. Next: development
		 * animation, branded frame and final result.
		 */
		console.log("Continue with selfie:", photoUrl);
	}

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#f1eeea]">
			<SelfieBoothScene
				onCapture={handleCapture}
				onRetake={handleRetake}
				capturedPhoto={photo}
			/>

			{photo && (
				<div className="pointer-events-none absolute right-4 top-4 z-40 sm:right-6 sm:top-6">
					<button
						onClick={handleContinue}
						className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/30 bg-[#123b78] px-5 py-3 text-xs font-bold tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(18,59,120,0.28)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-[#1b55a0] active:translate-y-0 sm:px-6 sm:py-3.5 sm:text-sm"
					>
						CONTINUE
						<span aria-hidden="true" className="text-base leading-none">
							→
						</span>
					</button>
				</div>
			)}
		</main>
	);
}
