// NOTE: This file is now a Server Component so that global CSS can be emitted
// as a static layout chunk (fixing 404s like /_next/static/css/app/layout.css).
// All client-only logic moved to ClientRoot.
import '../styles/globals.css';
import ClientRoot from './ClientRoot';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark1" suppressHydrationWarning>
      <head>
        <title>Watan Store</title>
        {/**
         * Viewport Strategy (Responsive Refactor):
         * - Previous behavior forced backoffice (/admin & /dev) to a desktop canvas: width=1280.
         *   That caused mobile devices to render a large, scaled‑down snapshot requiring pinch zoom to read.
         * - New default: Always use a responsive viewport: width=device-width, initial-scale=1, viewport-fit=cover.
         * - Optional temporary legacy fallback: set NEXT_PUBLIC_LEGACY_ADMIN_FIXED_WIDTH=1 (build/runtime env)
         *   to keep the old 1280px forced width ONLY for /admin & /dev while migrating individual pages.
         * - We still inject via script so we can branch on pathname without waiting for a client hydration pass.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var legacy = ${JSON.stringify(process.env.NEXT_PUBLIC_LEGACY_ADMIN_FIXED_WIDTH === '1')};
              var path = window.location.pathname;
              var isBackoffice = path.startsWith('/admin') || path.startsWith('/dev');
              var viewport = document.createElement('meta');
              viewport.name = 'viewport';
              if (isBackoffice && legacy) {
                viewport.content = 'width=1280, initial-scale=1';
              } else {
                viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
              }
              document.head.appendChild(viewport);
            })();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var t = localStorage.getItem('theme');
                if (t === null) { t = 'dark1'; }
                if (t === '') {
                  document.documentElement.removeAttribute('data-theme');
                } else {
                  document.documentElement.setAttribute('data-theme', t);
                }
              } catch (e) {
                document.documentElement.removeAttribute('data-theme');
              }
            })();`,
          }}
        />
        <meta name="theme-color" content="#0F1115" />
      </head>
      <body suppressHydrationWarning className="font-sans min-h-screen relative bg-bg-base text-text-primary">
        <div className="background" />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
