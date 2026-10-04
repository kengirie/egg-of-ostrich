import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';
import { homePath } from '@/lib/siteConfig';
import { EggShape } from './EggShape';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to={homePath()}
      className={`group inline-flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ${className ?? ''}`}
    >
      <EggShape className="h-10 w-9 motion-safe:group-hover:animate-wobble" />
      <span className="-rotate-2 font-display text-2xl leading-none tracking-tight text-primary [text-shadow:3px_3px_0_var(--color-border)] sm:text-3xl">
        EGG <span className="text-lg text-foreground [text-shadow:none] sm:text-xl">of</span> OSTRICHES
      </span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden">
      {/* the savanna */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-secondary" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 border-t-[3px] border-border bg-muted" />

      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <LoginArea className="max-w-60" />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 sm:px-6">{children}</main>

    </div>
  );
}
