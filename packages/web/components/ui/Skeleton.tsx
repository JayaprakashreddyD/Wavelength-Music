import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("skeleton-shimmer rounded-md", className)} />;
}
