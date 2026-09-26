import * as React from "react";
import { cn, initials } from "@/lib/utils";

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-cyan-400 to-blue-600",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ name, email, size = "md", className, ...props }: AvatarProps) {
  const label = initials(name, email);
  const seed = (name ?? email ?? "?").toLowerCase();
  const gradient = AVATAR_GRADIENTS[hashString(seed) % AVATAR_GRADIENTS.length];
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <div
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-soft ring-2 ring-white",
        gradient,
        sizes[size],
        className
      )}
      aria-hidden
      {...props}
    >
      {label}
    </div>
  );
}
