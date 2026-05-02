"use client";

import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Convenience re-export so existing imports keep working.
 * All state is now backed by a single `AuthProvider` context.
 */
export function useAuth() {
  return useAuthContext();
}
