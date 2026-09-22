import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
	title: "OPEXN Auditorium",
	description:
		"Interactive 3D auditorium experience built with Next.js and Three.js",
};
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className="h-full w-full overflow-hidden antialiased dark"
		>
			<body className="h-full w-full overflow-hidden bg-black text-white">
				{children}
			</body>
			<Analytics />
			<SpeedInsights />
		</html>
	);
}
