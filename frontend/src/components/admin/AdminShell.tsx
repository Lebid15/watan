'use client';

import { ReactNode } from 'react';

export default function AdminShell({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-container bg-bg-surface border border-border rounded-xl p-4 sm:p-5">
      {(title || actions) && (
        <header className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <div />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
