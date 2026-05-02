"use client";

import dynamic from "next/dynamic";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";

const SanityAppProvider = dynamic(
  () => import("@/components/providers/SanityAppProvider"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="size-10" />
      </div>
    ),
  },
);

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <SanityAppProvider>{children}</SanityAppProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
