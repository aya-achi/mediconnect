import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "pr", "prof"]);

export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0 && !HONORIFICS.has(p.toLowerCase()));
  if (parts.length === 0) return fallback;
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
