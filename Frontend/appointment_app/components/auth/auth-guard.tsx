"use client";

import { useAuth } from "@/hooks/useAuth";
import { getAccessToken } from "@/lib/auth";
import { UserRole } from "@/types/user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { isLoading, isAuthenticated, hasRole, refreshUser } = useAuth();
  const router = useRouter();
  const triedTokenRefresh = useRef(false);

  const hasAllowedRole = useMemo(
    () => !allowedRoles || allowedRoles.some((role) => hasRole(role)),
    [allowedRoles, hasRole],
  );

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (getAccessToken() && !triedTokenRefresh.current) {
        triedTokenRefresh.current = true;
        void refreshUser();
        return;
      }

      router.replace("/auth/login");
      return;
    }

    if (!hasAllowedRole) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, hasAllowedRole, refreshUser, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-400" />
      </div>
    );
  }

  if (!isAuthenticated || !hasAllowedRole) {
    return null;
  }

  return <>{children}</>;
}
