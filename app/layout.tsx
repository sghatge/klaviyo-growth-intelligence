import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ArtFlow AI | Klaviyo Growth Intelligence", description: "AI-powered D2C lifecycle marketing portfolio built around Klaviyo concepts." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
