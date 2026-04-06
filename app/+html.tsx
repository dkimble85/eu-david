import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>EU David</title>

        {/* iOS Home Screen metadata */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EU David" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo192.png" />

        {/* PWA metadata */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#003399" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
