import * as THREE from "three";

/*
 * Idle screen shown on the booth display before the camera starts.
 * Drawn at 1184x984 (same aspect as the 5.92 x 4.92 screen) so it maps
 * 1:1 with no repeating, stretching or aliasing.
 */

const W = 1184;
const H = 984;

function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

export function createIdleScreenTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;

	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return new THREE.CanvasTexture(canvas);
	}

	roundedRect(ctx, 0, 0, W, H, 58);
	ctx.clip();

	/* Soft background */
	const bg = ctx.createLinearGradient(0, 0, 0, H);
	bg.addColorStop(0, "#f6faff");
	bg.addColorStop(1, "#dbeafd");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	/* Very subtle staggered dots */
	ctx.fillStyle = "rgba(70, 130, 210, 0.16)";
	for (let row = 0, y = 40; y < H; row++, y += 52) {
		for (let x = 40 + (row % 2) * 26; x < W; x += 52) {
			ctx.beginPath();
			ctx.arc(x, y, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	/* Camera icon */
	const cx = W / 2;
	const cy = H / 2 - 50;

	ctx.save();
	ctx.shadowColor = "rgba(18, 59, 120, 0.25)";
	ctx.shadowBlur = 30;
	ctx.shadowOffsetY = 12;

	ctx.fillStyle = "#123b78";
	roundedRect(ctx, cx - 140, cy - 90, 280, 190, 34);
	ctx.fill();
	roundedRect(ctx, cx - 55, cy - 125, 110, 50, 14);
	ctx.fill();
	ctx.restore();

	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.arc(cx, cy + 5, 66, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = "#168cff";
	ctx.beginPath();
	ctx.arc(cx, cy + 5, 42, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = "#123b78";
	ctx.beginPath();
	ctx.arc(cx, cy + 5, 18, 0, Math.PI * 2);
	ctx.fill();

	/* Text */
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	ctx.fillStyle = "#123b78";
	ctx.font = "800 60px system-ui, -apple-system, 'Segoe UI', sans-serif";
	ctx.fillText("TAKE A SELFIE", cx, cy + 190);

	ctx.fillStyle = "#506070";
	ctx.font = "500 34px system-ui, -apple-system, 'Segoe UI', sans-serif";
	ctx.fillText("Tap the button below to start", cx, cy + 255);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.needsUpdate = true;

	return texture;
}
