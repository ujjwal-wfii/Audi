export async function startCamera(
	video: HTMLVideoElement,
): Promise<MediaStream> {
	const stream = await navigator.mediaDevices.getUserMedia({
		video: {
			facingMode: "user",
			width: { ideal: 1280 },
			height: { ideal: 720 },
		},
		audio: false,
	});

	video.srcObject = stream;

	return stream;
}

export function stopCamera(stream: MediaStream | null) {
	if (!stream) return;

	stream.getTracks().forEach((track) => {
		track.stop();
	});
}

export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement("canvas");

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const context = canvas.getContext("2d");

		if (!context) {
			reject(new Error("Unable to create canvas context"));
			return;
		}

		context.translate(canvas.width, 0);
		context.scale(-1, 1);

		context.drawImage(video, 0, 0, canvas.width, canvas.height);

		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("Failed to capture image"));
					return;
				}

				resolve(blob);
			},
			"image/jpeg",
			0.9,
		);
	});
}
