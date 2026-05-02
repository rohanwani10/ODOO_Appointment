"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { User } from "@/types/user";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await apiFetch<User>("/api/users/me");
        setUserProfile(data);
        setProfileForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
        });
      } catch (error) {
        console.error("Failed to fetch user profile", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const updateField = (field: keyof typeof profileForm, value: string) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const updated = await apiFetch<User>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone || null,
        }),
      });

      setUserProfile(updated);
      setProfileMessage("Profile updated successfully.");
    } catch (error: any) {
      setProfileError(error.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    setPasswordError("");

    try {
      await apiFetch("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });

      setPasswordMessage("Password changed. You should log in again.");
      setPasswordForm({ current_password: "", new_password: "" });
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-2 text-slate-300">
          Manage the profile data that the backend stores for this account.
        </p>
      </header>

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-slate-300">
          Loading profile...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={saveProfile}
            className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
          >
            <h2 className="text-lg font-semibold text-white">
              Profile information
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  First name
                </label>
                <input
                  value={profileForm.first_name}
                  onChange={(event) =>
                    updateField("first_name", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Last name
                </label>
                <input
                  value={profileForm.last_name}
                  onChange={(event) =>
                    updateField("last_name", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Phone
                </label>
                <input
                  value={profileForm.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Email
                </label>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-300">
                  {userProfile?.email}
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
              {profileMessage && (
                <p className="text-sm text-emerald-300">{profileMessage}</p>
              )}
              {profileError && (
                <p className="text-sm text-red-300">{profileError}</p>
              )}
            </div>
          </form>

          <form
            onSubmit={savePassword}
            className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
          >
            <h2 className="text-lg font-semibold text-white">
              Change password
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Current password
                </label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      current_password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  New password
                </label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      new_password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? "Updating..." : "Change password"}
              </button>
              {passwordMessage && (
                <p className="text-sm text-emerald-300">{passwordMessage}</p>
              )}
              {passwordError && (
                <p className="text-sm text-red-300">{passwordError}</p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
