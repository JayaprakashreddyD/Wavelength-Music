"use client";

import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { api, API_URL, getAccessToken } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { show } = useToast();
  const [username, setUsername] = useState(user?.username ?? "");
  const email = user?.email ?? "";
  const [requestedEmail, setRequestedEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch("/users/me", { username });
      await refreshUser();
      show("Profile updated", "success");
    } catch {
      show("Couldn't update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/users/me/email-change", { email: requestedEmail });
      setRequestedEmail("");
      show("Check your new email for a verification link", "success");
    } catch {
      show("Couldn't send the verification email", "error");
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.post("/users/me/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      show("Password changed", "success");
    } catch {
      show("Couldn't change password — check your current password", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: form,
    });
    if (res.ok) {
      await refreshUser();
      show("Profile picture updated", "success");
    } else {
      show("Couldn't upload image", "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-7 md:px-9 md:py-9">
      <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Your account</p><h1 className="text-3xl font-extrabold tracking-tight text-white">Profile settings</h1><p className="mt-2 text-sm text-base-300">Manage your identity and sign-in details.</p></div>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-accent/30 bg-gradient-to-br from-[#1a3a38] to-[#1e2b3c] text-xl font-bold uppercase shadow-[0_0_20px_rgba(0,245,155,0.15)]">
          {user?.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profileImage} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-accent/40" />
          ) : (
            user?.username?.slice(0, 2)
          )}
        </div>
        <label className="cursor-pointer text-sm font-medium text-accent-bright transition-colors hover:text-white drop-shadow-[0_0_6px_rgba(0,245,155,0.3)]">
          Change profile picture
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </label>
      </div>

      <form onSubmit={handleProfileSave} className="surface-panel space-y-4 rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-bold text-white">Profile</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <form onSubmit={handleEmailChange} className="surface-panel space-y-4 rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-bold text-white">Email address</h2>
        <p className="text-sm text-base-300">Current email: {email}. We will only change it after you verify the new address.</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">New email</label>
          <Input type="email" value={requestedEmail} onChange={(e) => setRequestedEmail(e.target.value)} required />
        </div>
        <Button type="submit">Send verification link</Button>
      </form>

      <form onSubmit={handlePasswordChange} className="surface-panel space-y-4 rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-bold text-white">Change password</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">Current password</label>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">New password</label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
