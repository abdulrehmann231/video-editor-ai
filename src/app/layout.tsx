import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'edit-ai — B2B video editor',
  description: 'Upload a raw B2B video; AI edits it like a human editor (non-generative).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            🎬 edit-ai
          </a>
          <span className="tag">Phase 0 · upload &amp; ingest</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
