"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type {
  Appointment,
  GoogleAuthorizationResponse,
  GoogleCalendarItem,
  User,
} from "@/lib/types";

export default function SettingsPage() {
  const { refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [preferences, setPreferences] = useState("{}");
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [user, prefs, upcomingAppointments, historyAppointments] = await Promise.all([
        apiFetch<User>("/api/users/me"),
        apiFetch<{ preferences: unknown }>("/api/users/me/preferences"),
        apiFetch<Appointment[]>("/api/customers/upcoming-appointments"),
        apiFetch<Appointment[]>("/api/customers/appointment-history"),
      ]);

      setProfile(user);
      setProfileForm({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || "",
      });
      setPreferences(JSON.stringify(prefs.preferences ?? {}, null, 2));
      setUpcoming(upcomingAppointments);
      setHistory(historyAppointments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleProfileUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(profileForm),
      });
      await refreshUser();
      await loadData();
      setMessage("Profile updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update profile");
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const response = await apiFetch<{ message: string }>("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });
      setMessage(response.message);
      await logout();
      window.location.replace("/auth/login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to change password");
    }
  }

  async function handlePreferencesSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const parsedPreferences = JSON.parse(preferences);
      await apiFetch("/api/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences: parsedPreferences }),
      });
      setMessage("Preferences updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save preferences");
    }
  }

  async function handlePhotoUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoFile) {
      setError("Select a photo first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", photoFile);

    try {
      await apiFetch("/api/users/me/photo", {
        method: "POST",
        body: formData,
      });
      await refreshUser();
      await loadData();
      setMessage("Profile photo uploaded.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to upload photo");
    }
  }

  async function handleLogoutAllDevices() {
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/logout-all-devices", {
        method: "POST",
      });
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to logout all devices");
    }
  }

  async function handleGoogleConnect() {
    try {
      const response = await apiFetch<GoogleAuthorizationResponse>(
        "/api/auth/google/authorization-url",
        { skipAuth: true },
      );
      window.location.href = response.authorization_url;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start Google auth");
    }
  }

  async function handleLoadGoogleCalendars() {
    try {
      const calendars = await apiFetch<GoogleCalendarItem[]>("/api/auth/google/calendar/list");
      setGoogleCalendars(calendars);
      setMessage("Google calendars loaded.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to load Google calendars");
    }
  }

  return (
    <RequireAuth>
      <div className="page">
        <section className="panel">
          <h1>Settings</h1>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {profile ? (
            <p>
              Signed in as {profile.first_name} {profile.last_name} ({profile.email})
            </p>
          ) : null}
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Profile</h2>
            <form className="form" onSubmit={handleProfileUpdate}>
              <label className="field">
                <span>First name</span>
                <input
                  value={profileForm.first_name}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, first_name: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  value={profileForm.last_name}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, last_name: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
              <button type="submit">Save profile</button>
            </form>

            <form className="form" onSubmit={handlePhotoUpload}>
              <label className="field">
                <span>Profile photo</span>
                <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit">Upload photo</button>
            </form>
          </div>

          <div className="panel">
            <h2>Password and devices</h2>
            <form className="form" onSubmit={handlePasswordChange}>
              <label className="field">
                <span>Current password</span>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, current_password: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
                  }
                />
              </label>
              <button type="submit">Change password</button>
            </form>
            <button type="button" onClick={() => void handleLogoutAllDevices()}>
              Logout all devices
            </button>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Preferences</h2>
            <form className="form" onSubmit={handlePreferencesSave}>
              <label className="field">
                <span>Preferences JSON</span>
                <textarea
                  rows={10}
                  value={preferences}
                  onChange={(event) => setPreferences(event.target.value)}
                />
              </label>
              <button type="submit">Save preferences</button>
            </form>
          </div>

          <div className="panel">
            <h2>Google integration</h2>
            <div className="row">
              <button type="button" onClick={() => void handleGoogleConnect()}>
                Connect Google
              </button>
              <button type="button" onClick={() => void handleLoadGoogleCalendars()}>
                Load calendars
              </button>
            </div>
            <div className="list">
              {googleCalendars.map((calendar) => (
                <article key={calendar.id} className="item">
                  <strong>{calendar.summary || calendar.id}</strong>
                  <p>ID: {calendar.id}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Upcoming appointments</h2>
            <div className="list">
              {upcoming.map((appointment) => (
                <article key={appointment.id} className="item">
                  <p>Appointment #{appointment.id}</p>
                  <p>{appointment.start_time}</p>
                  <p>Status: {appointment.status}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Appointment history</h2>
            <div className="list">
              {history.map((appointment) => (
                <article key={appointment.id} className="item">
                  <p>Appointment #{appointment.id}</p>
                  <p>{appointment.start_time}</p>
                  <p>Status: {appointment.status}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
