import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "patient" | "doctor" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

interface AuthState {
  user: AuthUser | null;
  theme: "light" | "dark";
  logout: () => void;
  toggleTheme: () => void;
  setUser: (user: AuthUser, token?: string) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      theme: "light",
      logout: () => {
        localStorage.removeItem("mediconnect-auth-token");
        set({ user: null });
      },
      toggleTheme: () => {
        const next = get().theme === "light" ? "dark" : "light";
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", next === "dark");
        }
        set({ theme: next });
      },
      setUser: (user: AuthUser, token?: string) => {
        if (token) localStorage.setItem("mediconnect-auth-token", token);
        set({ user });
      },
    }),
    { name: "mediconnect-auth" },
  ),
);
