import {
	FilesetResolver,
	ImageSegmenter,
	type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

/*
 * Setup required in your project (not code — one-time asset steps):
 *
 * 1. npm install @mediapipe/tasks-vision
 *
 * 2. Copy the WASM runtime so it's served locally instead of depending on
 *    an external CDN at runtime:
 *      cp -r node_modules/@mediapipe/tasks-vision/wasm public/mediapipe/wasm
 *
 * 3. Download the selfie segmenter model and place it in /public/models/:
 *      https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
 *    Save it as: public/models/selfie_segmenter.tflite
 *
 * Both paths below assume that layout. Adjust if you place them elsewhere.
 */

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/selfie_segmenter.tflite";

let segmenterPromise: Promise<ImageSegmenter | null> | null = null;

async function createSegmenter(
	delegate: "GPU" | "CPU",
): Promise<ImageSegmenter> {
	const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

	return ImageSegmenter.createFromOptions(vision, {
		baseOptions: {
			modelAssetPath: MODEL_PATH,
			delegate,
		},
		runningMode: "VIDEO",
		outputCategoryMask: false,
		outputConfidenceMasks: true,
	});
}

/*
 * Loads once, lazily, on first call. Tries GPU delegate first (fastest),
 * falls back to CPU, and returns null (never throws) if both fail — the
 * caller is expected to treat null as "background removal unavailable,
 * fall back to plain camera".
 */
export function getSegmenter(): Promise<ImageSegmenter | null> {
	if (!segmenterPromise) {
		segmenterPromise = createSegmenter("GPU")
			.catch(() => createSegmenter("CPU"))
			.catch((err) => {
				console.error("Selfie segmenter failed to load:", err);
				return null;
			});
	}

	return segmenterPromise;
}

export function disposeSegmenter() {
	if (segmenterPromise) {
		segmenterPromise.then((segmenter) => segmenter?.close());
		segmenterPromise = null;
	}
}

/*
 * Runs segmentation on one frame and paints the foreground-confidence mask
 * onto maskCanvas as alpha (white RGB, alpha = person probability).
 * `source` should already be in the SAME orientation (mirrored, cropped)
 * as what you'll composite it against, so no extra flips are needed later.
 */
export function segmentAndPaintMask(
	segmenter: ImageSegmenter,
	source: HTMLCanvasElement,
	timestampMs: number,
	maskCanvas: HTMLCanvasElement,
) {
	segmenter.segmentForVideo(
		source,
		timestampMs,
		(result: ImageSegmenterResult) => {
			const mask = result.confidenceMasks?.[0];

			if (!mask) {
				result.close?.();
				return;
			}

			const data = mask.getAsFloat32Array();
			const w = mask.width;
			const h = mask.height;

			const tmp = document.createElement("canvas");
			tmp.width = w;
			tmp.height = h;

			const tmpCtx = tmp.getContext("2d");

			if (tmpCtx) {
				const imageData = tmpCtx.createImageData(w, h);

				for (let i = 0; i < w * h; i++) {
					const alpha = Math.min(
						255,
						Math.max(0, Math.round(data[i] * 255)),
					);
					imageData.data[i * 4 + 0] = 255;
					imageData.data[i * 4 + 1] = 255;
					imageData.data[i * 4 + 2] = 255;
					imageData.data[i * 4 + 3] = alpha;
				}

				tmpCtx.putImageData(imageData, 0, 0);

				const maskCtx = maskCanvas.getContext("2d");

				if (maskCtx) {
					maskCtx.clearRect(
						0,
						0,
						maskCanvas.width,
						maskCanvas.height,
					);
					maskCtx.imageSmoothingEnabled = true;
					// Upscaling with smoothing on is what feathers the mask edge
					// so hair/shoulders don't look cut out.
					maskCtx.drawImage(
						tmp,
						0,
						0,
						maskCanvas.width,
						maskCanvas.height,
					);
				}
			}

			mask.close();
			result.close?.();
		},
	);
}
