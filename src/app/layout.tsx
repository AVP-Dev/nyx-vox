import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "NYX Vox",
    description: "AI Voice-to-Text Dictation",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
