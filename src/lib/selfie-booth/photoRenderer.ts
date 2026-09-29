// lib/selfie-booth/photoRenderer.ts

import type { SelfieTemplate } from "./templates";

export async function generateFinalPhoto(
	selfie: Blob,
	template: SelfieTemplate,
): Promise<Blob> {
	const selfieUrl = URL.createObjectURL(selfie);

	try {
		const selfieImage = await loadImage(selfieUrl);
		const background = await loadImage(template.background);

		const canvas = document.createElement("canvas");

		canvas.width = background.width;
		canvas.height = background.height;

		const context = canvas.getContext("2d");

		if (!context) {
			throw new Error("Unable to create canvas context");
		}

		context.drawImage(background, 0, 0, canvas.width, canvas.height);

		// We'll define the exact selfie position after
		// designing the three templates.
		const photoWidth = canvas.width * 0.8;
		const photoHeight =
			photoWidth * (selfieImage.height / selfieImage.width);

		const photoX = (canvas.width - photoWidth) / 2;
		const photoY = canvas.height * 0.12;

		context.drawImage(selfieImage, photoX, photoY, photoWidth, photoHeight);

		if (template.frame) {
			const frame = await loadImage(template.frame);

			context.drawImage(frame, 0, 0, canvas.width, canvas.height);
		}

		return await canvasToBlob(canvas);
	} finally {
		URL.revokeObjectURL(selfieUrl);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();

		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Failed to load image: ${src}`));

		image.src = src;
	});
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("Failed to generate image"));
				return;
			}

			resolve(blob);
		}, "image/png");
	});
}
