import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { setTokens } from "@/lib/auth";

export function useGoogleLogin() {
    const { refreshUser } = useAuth();

    const handleGoogleSuccess = useCallback(
        async (credentialResponse: any) => {
            try {
                // Send the authorization code to backend
                const response = await fetch("/api/auth/google/callback", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        code: credentialResponse.credential,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Google authentication failed");
                }

                const data = await response.json();

                // Store tokens
                setTokens(data.access_token, data.refresh_token);

                // Refresh user context
                await refreshUser();

                return {
                    success: true,
                    user: data.user,
                };
            } catch (error) {
                console.error("Google login error:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        },
        [refreshUser]
    );

    return {
        handleGoogleSuccess,
    };
}
