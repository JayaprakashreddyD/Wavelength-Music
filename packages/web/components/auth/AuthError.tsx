import { CircleAlert } from "lucide-react";

export function AuthError({ message, heading = "We couldn't complete that" }: { message: string; heading?: string }) {
  return (
    <div className="auth-error" role="alert" aria-live="polite">
      <CircleAlert size={17} aria-hidden="true" />
      <div className="min-w-0"><p className="text-sm font-medium">{heading}</p><p className="mt-0.5 break-words text-xs leading-relaxed text-red-200/75">{message}</p></div>
    </div>
  );
}
