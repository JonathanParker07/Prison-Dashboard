// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Prison Management Dashboard",
  description: "Facial-recognition prison management UI",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* AuthProvider wraps entire app so all pages have access to auth context */}
        <AuthProvider>
          {/* Navbar is rendered for all pages */}
          <Navbar />
          <main className="p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
