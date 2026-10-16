"use client";

import { useCallback, useState } from "react";

interface UseSelfieShareResult {
	sharing: boolean;
	shareError: string | null;
	download: (photo: Blob, filename?: string) => void;
	share: (photo: Blob) => Promise<boolean>;
}

export function useSelfieShare(): UseSelfieShareResult {
	const [sharing, setSharing] = useState(false);
	const [shareError, setShareError] = useState<string | null>(null);

	const download = useCallback(
		(photo: Blob, filename = "opexn-selfie.jpg") => {
			const url = URL.createObjectURL(photo);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
		[],
	);

	const share = useCallback(
		async (photo: Blob): Promise<boolean> => {
			setSharing(true);
			setShareError(null);

			const file = new File([photo], "opexn-selfie.jpg", {
				type: "image/jpeg",
			});

			try {
				if (
					!navigator.share ||
					!navigator.canShare?.({ files: [file] })
				) {
					throw new Error(
						"File sharing is not supported on this device.",
					);
				}

				await navigator.share({
					files: [file],
					title: "My OPEXN Selfie",
					text: "Check out my selfie from OPEXN!",
				});
				return true;
			} catch (err) {
				if ((err as { name?: string })?.name === "AbortError") {
					return false;
				}
				console.error("Selfie share failed:", err);
				setShareError(
					err instanceof Error
						? err.message
						: "Could not share your selfie.",
				);
				return false;
			} finally {
				setSharing(false);
			}
		},
		[],
	);

	return { sharing, shareError, download, share };
}
