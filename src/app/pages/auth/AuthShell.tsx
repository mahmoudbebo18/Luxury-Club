import type { ReactNode } from 'react';

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="auth-page">
      <div className="container">
        <div className="auth-card join-form">
          <div className="form-head">
            <h1>{title}</h1>
            <p>{lead}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
