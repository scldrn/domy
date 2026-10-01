import type { ReactNode } from "react";

/** The centered card of the screens outside the panel: sign-in and recovery. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-low p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-sm">
        <h1 className="text-headline-s text-on-surface">{title}</h1>
        <p className="mt-1 mb-6 text-body-m text-on-surface-variant">{description}</p>
        {children}
      </div>
    </main>
  );
}
