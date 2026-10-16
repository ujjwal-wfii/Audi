"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/*
 * Renders client-side (no network call to a third-party QR image API),
 * which matters for a kiosk that may have an unreliable connection after
 * the upload itself already succeeded.
 *
 * npm install qrcode
 * npm install -D @types/qrcode
 */

interface SelfieQRCodeProps {
	value: string;
	size?: number;
}

export default function SelfieQRCode({ value, size = 180 }: SelfieQRCodeProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (!canvasRef.current) return;

		QRCode.toCanvas(canvasRef.current, value, {
			width: size,
			margin: 1,
			color: {
				dark: "#123b78",
				light: "#ffffff",
			},
		}).catch((err) => {
			console.error("QR code render failed:", err);
			setError(true);
		});
	}, [value, size]);

	if (error) {
		return (
			<p className="max-w-[180px] break-all text-center text-xs text-slate-500">
				{value}
			</p>
		);
	}

	return (
		<canvas
			ref={canvasRef}
			width={size}
			height={size}
			className="rounded-lg bg-white p-2 shadow-md"
		/>
	);
}
