"use client";

import { useCallback, useState } from "react";

export interface UploadedSelfie {
	id: string;
	url: string;
	shareUrl: string;
	expiresAt: string | null;
}

interface UseSelfieShareResult {
	uploading: boolean;
	uploadError: string | null;
	uploaded: UploadedSelfie | null;
	upload: (photo: Blob) => Promise<UploadedSelfie | null>;
	download: (photo: Blob, filename?: string) => void;
	share: (
		photo: Blob,
		shareUrl?: string,
	) => Promise<"shared" | "copied" | "downloaded">;
}

export function useSelfieShare(): UseSelfieShareResult {
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploaded, setUploaded] = useState<UploadedSelfie | null>(null);

	const upload = useCallback(
		async (photo: Blob): Promise<UploadedSelfie | null> => {
			setUploading(true);
			setUploadError(null);

			try {
				const formData = new FormData();
				formData.append("photo", photo, "selfie.jpg");

				const response = await fetch("/api/selfies", {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					const body = await response.json().catch(() => null);
					throw new Error(
						body?.error ?? `Upload failed (${response.status})`,
					);
				}

				const data = (await response.json()) as UploadedSelfie;
				setUploaded(data);
				return data;
			} catch (err) {
				console.error("Selfie upload failed:", err);
				setUploadError(
					err instanceof Error
						? err.message
						: "Could not upload photo. Please try again.",
				);
				return null;
			} finally {
				setUploading(false);
			}
		},
		[],
	);

	const download = useCallback(
		(photo: Blob, filename = "opexn-selfie.jpg") => {
			const url = URL.createObjectURL(photo);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			// Give the browser a tick to start the download before revoking.
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
		[],
	);

	/*
	 * Tries, in order:
	 * 1. Web Share API with the actual file (native share sheet: Mail,
	 *    Messages, AirDrop, WhatsApp, etc.) — best UX, works on iOS Safari
	 *    and Chrome/Edge on Android + desktop.
	 * 2. Web Share API with just the link (if sharing files isn't
	 *    supported but sharing a URL is).
	 * 3. Clipboard: copies the link text so the person can paste it
	 *    somewhere themselves.
	 * 4. Plain download, as a last resort (e.g. Firefox, which supports
	 *    none of the above as of this writing).
	 */
	const share = useCallback(
		async (
			photo: Blob,
			shareUrl?: string,
		): Promise<"shared" | "copied" | "downloaded"> => {
			const file = new File([photo], "opexn-selfie.jpg", {
				type: "image/jpeg",
			});

			if (navigator.share) {
				try {
					if (navigator.canShare?.({ files: [file] })) {
						await navigator.share({
							files: [file],
							title: "My OPEXN Selfie",
							text: shareUrl
								? undefined
								: "Check out my selfie from OPEXN!",
						});
						return "shared";
					}

					if (shareUrl) {
						await navigator.share({
							title: "My OPEXN Selfie",
							url: shareUrl,
						});
						return "shared";
					}
				} catch (err) {
					// AbortError = user cancelled the share sheet; not a failure.
					if ((err as { name?: string })?.name !== "AbortError") {
						console.error("navigator.share failed:", err);
					} else {
						return "shared";
					}
				}
			}

			if (shareUrl && navigator.clipboard?.writeText) {
				try {
					await navigator.clipboard.writeText(shareUrl);
					return "copied";
				} catch (err) {
					console.error("Clipboard copy failed:", err);
				}
			}

			download(photo);
			return "downloaded";
		},
		[download],
	);

	return { uploading, uploadError, uploaded, upload, download, share };
}
