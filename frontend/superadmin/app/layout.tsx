import { Cairo } from 'next/font/google';
import { Suspense } from 'react';
import '../styles/globals.css';
import LayoutClient from './layoutClient';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata = {
  title: 'SuperAdmin - Ahla Store',
  description: 'لوحة تحكم المدير العام',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var t = localStorage.getItem('theme');
                if (!t) { t = 'dark1'; }
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
      <body className={cairo.className} suppressHydrationWarning>
        <Suspense fallback={null}>
          <LayoutClient>{children}</LayoutClient>
        </Suspense>
      </body>
    </html>
  );
}
