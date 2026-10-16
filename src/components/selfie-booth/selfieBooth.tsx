"use client";

import { useEffect, useMemo, useState } from "react";

import SelfieBoothScene from "./3d/SelfieBoothScene";
import { SELFIE_TEMPLATES } from "@/lib/selfie-booth/templates";
import { generateFinalPhoto } from "@/lib/selfie-booth/photoRenderer";
import { useSelfieShare } from "@/lib/selfie-booth/userSelfieShare";

export default function SelfieBooth() {
	const [rawPhoto, setRawPhoto] = useState<Blob | null>(null);
	const [finalPhoto, setFinalPhoto] = useState<Blob | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { download, share, sharing, shareError } = useSelfieShare();

	const finalPhotoUrl = useMemo(
		() => (finalPhoto ? URL.createObjectURL(finalPhoto) : null),
		[finalPhoto],
	);

	useEffect(() => {
		return () => {
			if (finalPhotoUrl) URL.revokeObjectURL(finalPhotoUrl);
		};
	}, [finalPhotoUrl]);

	function handleCapture(capturedPhoto: Blob) {
		setRawPhoto(capturedPhoto);
		setFinalPhoto(null);
		setError(null);
	}

	function handleRetake() {
		setRawPhoto(null);
		setFinalPhoto(null);
		setError(null);
	}

	async function handleContinue() {
		if (!rawPhoto) return;

		setError(null);
		try {
			const classicTemplate = SELFIE_TEMPLATES.find(
				(template) => template.id === "classic",
			);
			if (!classicTemplate) {
				throw new Error("Selfie frame is unavailable.");
			}

			setFinalPhoto(
				await generateFinalPhoto(rawPhoto, classicTemplate),
			);
		} catch (err) {
			console.error("Selfie preview generation failed:", err);
			setError(
				err instanceof Error
					? err.message
					: "Could not prepare your selfie.",
			);
		}
	}

	async function handleShare() {
		if (!finalPhoto) return;
		setError(null);
		await share(finalPhoto);
	}

	return (
		<main className="relative h-svh w-full overflow-hidden bg-[#f1eeea]">
			<SelfieBoothScene
				onCapture={handleCapture}
				onRetake={handleRetake}
				capturedPhoto={rawPhoto}
			/>

			{rawPhoto && !finalPhoto && (
				<section className="absolute inset-x-0 bottom-0 z-50 p-4 shadow-2xl  sm:p-6">
					<div className="mx-auto flex max-w-3xl flex-col gap-4">
						<button
							onClick={handleContinue}
							className="mx-auto rounded-full bg-white px-8 py-3 text-sm font-bold tracking-wide text-[#123b78] transition hover:scale-105 active:scale-95"
						>
							CONTINUE
						</button>
					</div>
				</section>
			)}

			{finalPhoto && finalPhotoUrl && (
				<section
					role="dialog"
					aria-modal="true"
					aria-label="Your selfie"
					className="absolute inset-0 z-50 overflow-y-auto bg-[#123b78]/95 backdrop-blur"
					style={{
						/* Same dot grid language as the booth's idle screen */
						backgroundImage:
							"radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
						backgroundSize: "22px 22px",
					}}
				>
					<div className="flex min-h-full items-center justify-center p-3 sm:p-6">
						<div className="grid w-full max-w-6xl gap-5 rounded-[2rem] bg-[#f1eeea] p-4 shadow-2xl sm:p-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-8 lg:p-8">
							{/* ---------------------------------------------------------- */}
							{/* Photo print: white card, navy caption strip                 */}
							{/* ---------------------------------------------------------- */}
							<div className="flex items-center justify-center">
								<figure className="w-fit max-w-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-12px_rgba(18,59,120,0.45)]">
									<div className="p-2.5 sm:p-3">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={finalPhotoUrl}
											alt="Your selfie"
											draggable={false}
											className="block h-auto max-h-[52svh] w-auto max-w-full rounded-lg object-contain lg:max-h-[calc(100svh-14rem)]"
										/>
									</div>

									<figcaption className="relative flex items-center justify-between gap-4 bg-[#123b78] px-4 py-3 text-white">
										<span className="text-sm font-semibold tracking-wide">
											OPEXN
										</span>
										<span className="text-sm">
											#FutureTogether
										</span>

										{/* Cyan light along the bottom edge, like the booth counter */}
										<span
											aria-hidden="true"
											className="absolute inset-x-0 bottom-0 h-[3px] bg-[#8ddfff] shadow-[0_0_10px_2px_rgba(66,200,255,0.7)]"
										/>
									</figcaption>
								</figure>
							</div>

							{/* ---------------------------------------------------------- */}
							{/* Action rail                                                 */}
							{/* ---------------------------------------------------------- */}
							<div className="flex flex-col justify-center gap-5">
								<div>
									<p className="text-4xl font-light tracking-wide text-[#123b78]">
										OPEXN
									</p>
									<h1 className="mt-1 text-2xl font-black text-[#123b78]">
										Your selfie is ready
									</h1>
									<p className="mt-1 text-sm text-slate-600">
										Tap Share to send your framed selfie
										directly from this device.
									</p>
									<div className="mt-4 h-[3px] w-16 rounded-full bg-[#42c8ff]" />
								</div>

								<div className="flex flex-col gap-3">
									<button
										type="button"
										onClick={() => download(finalPhoto)}
										className="w-full rounded-full bg-[#123b78] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg transition duration-200 hover:bg-[#1b55a0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#42c8ff]/60 motion-safe:hover:scale-[1.03] motion-safe:active:scale-95"
									>
										DOWNLOAD SELFIE
									</button>

									<button
										type="button"
										onClick={handleShare}
										disabled={sharing}
										aria-busy={sharing}
										className="w-full rounded-full bg-[#42c8ff] px-6 py-3.5 text-sm font-bold tracking-wide text-[#123b78] shadow-lg transition duration-200 hover:bg-[#6fd6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#123b78]/40 disabled:opacity-60 motion-safe:hover:scale-[1.03] motion-safe:active:scale-95"
									>
										{sharing ? "OPENING SHARE…" : "SHARE SELFIE"}
									</button>

									<button
										type="button"
										onClick={handleRetake}
										className="w-full rounded-full border-2 border-[#123b78] px-6 py-3.5 text-sm font-bold tracking-wide text-[#123b78] transition duration-200 hover:bg-[#123b78]/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#42c8ff]/60 motion-safe:active:scale-95"
									>
										RETAKE
									</button>
								</div>

								{(error || shareError) && (
									<p
										role="alert"
										className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700"
									>
										{error ?? shareError}
									</p>
								)}
							</div>
						</div>
					</div>
				</section>
			)}
		</main>
	);
}
