/**
 * bgrun Dashboard — Root Layout (Server Component)
 *
 * Minimal layout — no header, just the page content.
 */

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <title>bgrun Dashboard</title>
        <meta
          name="description"
          content="bgrun — Bun Background Runner — Process Manager Dashboard"
        />
      </head>
      <body className="antialiased">
        <div className="container">
          <main id="melina-page-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
