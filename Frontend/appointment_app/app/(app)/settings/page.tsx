"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@/types/user";
import { motion } from "framer-motion";
import { 
  User as UserIcon, 
  Lock, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
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

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const updated = await apiFetch<User>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(profileForm),
      });
      setUserProfile(updated);
      setProfileMessage("Identity updated successfully.");
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    setPasswordError("");

    try {
      await apiFetch("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });
      setPasswordMessage("Credentials secured. Relogging...");
      await logout();
      setTimeout(() => router.replace("/auth/login"), 1500);
    } catch (err: any) {
      setPasswordError(err.message || "Security update failed.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Page Header */}
      <section className="glass-premium rounded-[40px] p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
              <Settings className="size-3.5" />
              Account Preferences
            </div>
            <h1 className="text-gradient text-4xl font-bold tracking-tight">
              Settings & Security
            </h1>
            <p className="text-slate-400 max-w-xl">
              Configure your personal identity and secure your access credentials.
            </p>
          </div>
          <div className="glass flex items-center gap-3 rounded-full px-6 py-3 border-white/5">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-white">Trust Level: Verified</span>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
           <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="size-10 rounded-full border-t-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Profile Form */}
          <motion.form 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={saveProfile}
            className="glass-premium group rounded-[40px] p-8 lg:p-10"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserIcon className="size-6" />
              </div>
              <h2 className="text-2xl font-bold text-white">Profile Identity</h2>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">First Name</label>
                  <input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 text-white outline-none focus:border-primary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Last Name</label>
                  <input
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 text-white outline-none focus:border-primary/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-4 py-3.5 text-white outline-none focus:border-primary/50"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Registered Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <div className="w-full rounded-2xl border border-white/5 bg-white/[0.02] pl-12 pr-4 py-3.5 text-slate-500">
                    {userProfile?.email}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="group relative flex h-14 w-full items-center justify-center rounded-2xl bg-white font-bold text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {savingProfile ? "Syncing..." : "Update Identity"}
                <Sparkles className="ml-2 size-4 text-primary" />
              </button>

              {profileMessage && <p className="text-center text-xs font-bold text-emerald-400 uppercase tracking-widest">{profileMessage}</p>}
              {profileError && <p className="text-center text-xs font-bold text-rose-400 uppercase tracking-widest">{profileError}</p>}
            </div>
          </motion.form>

          {/* Password Form */}
          <motion.form 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={savePassword}
            className="glass-premium rounded-[40px] p-8 lg:p-10"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                <Lock className="size-6" />
              </div>
              <h2 className="text-2xl font-bold text-white">Security Access</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Current Secret</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 text-white outline-none focus:border-rose-500/30"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">New Secret</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 text-white outline-none focus:border-rose-500/30"
                  required
                />
              </div>

              <div className="rounded-2xl bg-rose-500/5 p-4 border border-rose-500/10">
                <p className="text-xs leading-relaxed text-rose-200/60">
                  Changing your password will invalidate all active sessions and require a fresh sign-in on all devices.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="group relative flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-bold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {savingPassword ? "Securing..." : "Rotate Credentials"}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </button>

              {passwordMessage && <p className="text-center text-xs font-bold text-emerald-400 uppercase tracking-widest">{passwordMessage}</p>}
              {passwordError && <p className="text-center text-xs font-bold text-rose-400 uppercase tracking-widest">{passwordError}</p>}
            </div>
          </motion.form>
        </div>
      )}
    </motion.div>
  );
}
