// components/Navbar.tsx
"use client";

import { Home, UserPlus, Camera, Video, User, ClipboardList, LogOut, LogIn } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const { user, logout, isLoading, sessionReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClass = (href: string) =>
    `flex items-center gap-1 text-sm font-medium px-2 py-1 rounded ${
      isActive(href)
        ? "bg-gray-900 text-white"
        : "text-gray-700 hover:text-gray-900"
    }`;

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b bg-white">
      {/* Left logo */}
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 text-white p-2 rounded-lg">
          <span className="font-bold">PVS</span>
        </div>
        <div>
          <p className="font-semibold">Prison</p>
          <p className="text-xs text-gray-500 -mt-1">Verification System</p>
        </div>
      </div>

      {/* Center links */}
      <div className="flex items-center gap-2">
        <Link href="/" className={linkClass("/")}>
          <Home size={16} /> Dashboard
        </Link>
        <Link href="/inmates" className={linkClass("/inmates")}>
          <UserPlus size={16} /> Enroll Inmate
        </Link>
        <Link href="/recognition" className={linkClass("/recognition")}>
          <Camera size={16} /> Verify Inmate
        </Link>
        <Link href="/recognition/live" className={linkClass("/recognition/live")}>
          <Video size={16} /> Live
        </Link>
        <Link href="/inmates" className={linkClass("/inmates")}>
          <User size={16} /> Inmate History
        </Link>
        <Link href="/logs" className={linkClass("/logs")}>
          <ClipboardList size={16} /> Logs
        </Link>
      </div>

      {/* Right user area */}
      <div className="flex items-center gap-3">
        {!sessionReady ? (
          <span className="text-sm text-gray-500">Loading...</span>
        ) : user ? (
          <>
            <span className="text-sm text-gray-600">Logged in as:</span>
            <Link
              href="/staff-management"
              className="flex items-center gap-1 font-medium text-sm text-gray-800 hover:underline"
            >
              <User size={16} /> {user.name}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 ml-2"
            >
              <LogOut size={16} /> Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <LogIn size={16} /> Login
          </Link>
        )}
      </div>
    </nav>
  );
}
