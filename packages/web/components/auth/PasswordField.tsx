"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface PasswordFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  invalid?: boolean;
}

export function PasswordField({ id, value, onChange, autoComplete, required = true, minLength, maxLength, invalid }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-password-wrap">
      <Input
        id={id}
        className={`auth-input pr-12 ${invalid ? "auth-input-invalid" : ""}`}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
      />
      <button type="button" className="auth-password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
