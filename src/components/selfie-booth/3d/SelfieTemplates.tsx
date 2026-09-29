/*
 * Draws the selected template frame on top of the (already drawn) camera frame.
 * Maps by template id: anything containing "event" or "celebration" gets that
 * style, everything else falls back to Classic.
 * Keep the middle of the frame clear so faces are never covered.
 */

const NAVY = "#123b78";
const CYAN = "#42c8ff";
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function classic(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 56;
	ctx.strokeRect(0, 0, w, h);

	ctx.strokeStyle = NAVY;
	ctx.lineWidth = 4;
	ctx.strokeRect(28, 28, w - 56, h - 56);

	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, h - 96, w, 96);

	ctx.fillStyle = NAVY;
	ctx.textBaseline = "middle";
	ctx.font = `800 40px ${FONT}`;
	ctx.textAlign = "left";
	ctx.fillText("OPEXN", 44, h - 48);
	ctx.font = `600 30px ${FONT}`;
	ctx.textAlign = "right";
	ctx.fillText("#FutureTogether", w - 44, h - 48);
}

function event(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = NAVY;
	ctx.fillRect(0, 0, w, 84);
	ctx.fillRect(0, h - 120, w, 120);

	ctx.fillStyle = CYAN;
	ctx.fillRect(0, 84, w, 6);
	ctx.fillRect(0, h - 126, w, 6);

	ctx.fillStyle = "#ffffff";
	ctx.textBaseline = "middle";
	ctx.textAlign = "center";
	ctx.font = `600 28px ${FONT}`;
	ctx.fillText("CONNECT • LEARN • INNOVATE", w / 2, 44);

	ctx.font = `800 52px ${FONT}`;
	ctx.fillText("OPEXN", w / 2, h - 78);
	ctx.font = `600 24px ${FONT}`;
	ctx.fillText("#FutureTogether", w / 2, h - 32);
}

function celebration(ctx: CanvasRenderingContext2D, w: number, h: number) {
	const gradient = ctx.createLinearGradient(0, 0, w, h);
	gradient.addColorStop(0, "#ff5fa2");
	gradient.addColorStop(0.5, "#ffd23f");
	gradient.addColorStop(1, CYAN);

	ctx.strokeStyle = gradient;
	ctx.lineWidth = 56;
	ctx.strokeRect(0, 0, w, h);

	// Deterministic confetti (same every frame, no flicker)
	const colors = ["#ff5fa2", "#ffd23f", CYAN, "#7c5cff", "#ffffff"];
	let seed = 42;
	const rand = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};

	for (let i = 0; i < 60; i++) {
		const x = rand() * w;
		const top = i % 2 === 0;
		const y = top ? 20 + rand() * 130 : h - 150 + rand() * 130;

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rand() * Math.PI);
		ctx.fillStyle = colors[i % colors.length];
		ctx.fillRect(-7, -14, 14, 28);
		ctx.restore();
	}

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = `900 56px ${FONT}`;
	ctx.lineWidth = 8;
	ctx.strokeStyle = NAVY;
	ctx.fillStyle = "#ffffff";
	ctx.strokeText("CELEBRATE!", w / 2, h - 80);
	ctx.fillText("CELEBRATE!", w / 2, h - 80);
}

export function drawTemplateOverlay(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	templateId: string,
) {
	const id = templateId.toLowerCase();

	ctx.save();

	if (id.includes("celebration")) celebration(ctx, w, h);
	else if (id.includes("event")) event(ctx, w, h);
	else classic(ctx, w, h);

	ctx.restore();
}
