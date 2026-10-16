// lib/selfie-booth/photoRenderer.ts

import type { SelfieTemplate } from "./templates";
import { drawTemplateOverlay } from "@/components/selfie-booth/3d/SelfieTemplates";

export async function generateFinalPhoto(
	selfie: Blob,
	template: SelfieTemplate,
): Promise<Blob> {
	const selfieUrl = URL.createObjectURL(selfie);

	try {
		const selfieImage = await loadImage(selfieUrl);
		const canvas = document.createElement("canvas");
		canvas.width = selfieImage.width;
		canvas.height = selfieImage.height;

		const context = canvas.getContext("2d");

		if (!context) {
			throw new Error("Unable to create canvas context");
		}

		context.drawImage(selfieImage, 0, 0, canvas.width, canvas.height);
		drawTemplateOverlay(context, canvas.width, canvas.height, template.id);

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
		}, "image/jpeg", 0.92);
	});
}
