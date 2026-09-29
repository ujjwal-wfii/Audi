import * as THREE from "three";

/* Background image composited behind the segmented camera subject. */

const W = 1200;
const H = 1000;

let cached: HTMLCanvasElement | null = null;
let imageLoadStarted = false;

function drawFallbackBackground(ctx: CanvasRenderingContext2D) {
	/* Base wall tone remains visible until the public image finishes loading. */
	ctx.fillStyle = "#f3f0eb";
	ctx.fillRect(0, 0, W, H);

	const key = ctx.createRadialGradient(
		W * 0.72,
		H * 0.05,
		0,
		W * 0.72,
		H * 0.05,
		W * 0.85,
	);
	key.addColorStop(0, "rgba(255, 244, 232, 0.55)");
	key.addColorStop(1, "rgba(255, 244, 232, 0)");
	ctx.fillStyle = key;
	ctx.fillRect(0, 0, W, H);

	const fill = ctx.createRadialGradient(
		W * 0.22,
		H * 0.08,
		0,
		W * 0.22,
		H * 0.08,
		W * 0.7,
	);
	fill.addColorStop(0, "rgba(255, 255, 255, 0.3)");
	fill.addColorStop(1, "rgba(255, 255, 255, 0)");
	ctx.fillStyle = fill;
	ctx.fillRect(0, 0, W, H);

	const floor = ctx.createLinearGradient(0, H * 0.6, 0, H);
	floor.addColorStop(0, "rgba(60, 45, 35, 0)");
	floor.addColorStop(1, "rgba(60, 45, 35, 0.08)");
	ctx.fillStyle = floor;
	ctx.fillRect(0, 0, W, H);
}

function drawCoverImage(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement,
) {
	const targetAspect = W / H;
	const imageAspect = image.naturalWidth / image.naturalHeight;
	let sx = 0;
	let sy = 0;
	let sw = image.naturalWidth;
	let sh = image.naturalHeight;

	if (imageAspect > targetAspect) {
		sw = image.naturalHeight * targetAspect;
		sx = (image.naturalWidth - sw) / 2;
	} else {
		sh = image.naturalWidth / targetAspect;
		sy = (image.naturalHeight - sh) / 2;
	}

	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);
}

export function getBoothBackgroundCanvas(): HTMLCanvasElement {
	if (cached) return cached;

	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;

	const ctx = canvas.getContext("2d");

	if (!ctx) {
		cached = canvas;
		return canvas;
	}

	cached = canvas;
	drawFallbackBackground(ctx);

	if (!imageLoadStarted) {
		imageLoadStarted = true;
		const image = new Image();
		image.onload = () => {
			if (cached !== canvas) return;
			const imageContext = canvas.getContext("2d");
			if (imageContext) drawCoverImage(imageContext, image);
		};
		image.onerror = () => {
			console.error("Selfie booth background failed to load:", image.src);
		};
		image.src = "/selfie-booth/backgroundImage.png";
	}

	return canvas;
}

/* Only needed if you want to force a re-generate (e.g. after a theme change) */
export function resetBoothBackgroundCache() {
	cached = null;
	imageLoadStarted = false;
}

/* Convenience: an actual THREE texture version, if you ever want it on a mesh too */
export function createBoothBackgroundTexture(): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(getBoothBackgroundCanvas());
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}
