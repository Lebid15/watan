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
        {/* Viewport: enforce desktop width for backoffice (/admin & /dev), otherwise standard responsive */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var path = window.location.pathname;
                var isBackoffice = path.startsWith('/admin') || path.startsWith('/dev');
                var viewport = document.createElement('meta');
                viewport.name = 'viewport';
                viewport.content = isBackoffice ? 'width=1280, initial-scale=1' : 'width=device-width, initial-scale=1, viewport-fit=cover';
                document.head.appendChild(viewport);
              } catch(e) {}
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
