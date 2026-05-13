"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Loader2,
  Mail,
  Lock,
  User,
  Check,
  AtSign,
  Eye,
  EyeOff,
  Camera,
  Link as LinkIcon,
} from "lucide-react";
import { createUser } from "@/lib/user-actions";
import type { UserRole } from "@/types/profile.types";

const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

function buildDefaultAvatar(seed: string): string {
  const safeSeed = encodeURIComponent(seed.trim() || "qollaby");
  return `https://api.dicebear.com/9.x/initials/png?seed=${safeSeed}&backgroundColor=8b5cf6,3b82f6&textColor=ffffff`;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "unlimited", label: "Unlimited" },
];

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function AddUserDialog({ open, onOpenChange, onCreated }: AddUserDialogProps) {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [avatar, setAvatar] = useState("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setUsername("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole("user");
    setAvatar("");
    setAvatarPreviewError(false);
    setUploadingAvatar(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      const url = data.urls?.[0];
      if (!url) throw new Error("No file URL returned");
      setAvatar(url);
      setAvatarPreviewError(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(
        "Username must be 3-32 characters using lowercase letters, digits, dot, dash, or underscore"
      );
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const trimmedAvatar = avatar.trim();
    let finalAvatar = trimmedAvatar;
    if (!finalAvatar) {
      finalAvatar = buildDefaultAvatar(normalizedUsername);
    } else if (!/^https?:\/\//i.test(finalAvatar)) {
      setError("Avatar URL must start with http(s)://");
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        username: normalizedUsername,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role,
        avatar: finalAvatar,
      });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? "User";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden top-[5vh] translate-y-0 left-[50%] -translate-x-1/2 bg-card border-border/50">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. The user can sign in immediately with the email and password
            you set.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5"
        >
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || uploadingAvatar}
                className="relative h-16 w-16 rounded-full border-2 border-dashed border-border/60 hover:border-primary/60 bg-secondary/40 overflow-hidden flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-60 shrink-0"
                aria-label="Upload avatar"
                title="Click to upload avatar image"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : avatar && !avatarPreviewError ? (
                  <Image
                    src={avatar}
                    alt="Avatar preview"
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={() => setAvatarPreviewError(true)}
                    unoptimized
                  />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              <div className="relative flex-1 min-w-0">
                <Input
                  type="url"
                  value={avatar}
                  onChange={(e) => {
                    setAvatar(e.target.value);
                    setAvatarPreviewError(false);
                  }}
                  disabled={submitting}
                  placeholder="Avatar image URL (optional)"
                  className="pr-9"
                  autoComplete="off"
                />
                <LinkIcon className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Click the circle to upload, or paste an image URL. Leave empty to generate a default
              avatar from the username.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                placeholder="lowercase letters, digits, . _ -"
                className="pr-9 lowercase"
                autoComplete="off"
                required
              />
              <AtSign className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={submitting}
                  className="pr-9"
                  required
                />
                <User className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={submitting}
                  className="pr-9"
                  required
                />
                <User className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="pr-9"
                required
              />
              <Mail className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="pr-16"
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                />
                <Lock className="h-4 w-4 text-muted-foreground absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    className="w-full justify-between bg-secondary/50 border-border/50"
                  >
                    {roleLabel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] bg-card border-border/50">
                  {ROLE_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setRole(option.value)}
                      className="cursor-pointer"
                    >
                      {role === option.value && <Check className="h-4 w-4 mr-2" />}
                      <span className={role !== option.value ? "ml-6" : ""}>{option.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
