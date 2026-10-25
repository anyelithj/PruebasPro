"use client";
import { LogOut } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useRouter } from "next/navigation";
import { useState } from "react";
// [LogoutButton]: invoca /api/auth/logout y redirige | [Patron]: Container | [Principio]: SRP

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-danger transition-colors flex items-center gap-2 disabled:opacity-50"
    >
      <LogOut aria-hidden className="inline size-4 align-[-0.125em]" />
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
