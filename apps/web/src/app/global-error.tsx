"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <head>
        <title>Erreur critique | RPB</title>
        <style>{`
          body {
            margin: 0;
            background-color: #0a0a0f;
            color: #ffffff;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
          }
          .container {
            max-width: 500px;
            padding: 2rem;
            border: 1px solid #1f1f2e;
            border-radius: 12px;
            background-color: #11111a;
          }
          h1 {
            color: #ef4444;
            font-size: 1.75rem;
            margin-top: 0;
          }
          p {
            color: #a1a1aa;
            font-size: 1rem;
            margin-bottom: 1.5rem;
          }
          .digest {
            font-family: monospace;
            font-size: 0.85rem;
            color: #71717a;
            background-color: #1a1a24;
            padding: 0.5rem;
            border-radius: 6px;
            margin-bottom: 1.5rem;
            word-break: break-all;
          }
          button {
            background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button:hover {
            opacity: 0.9;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h1>Une erreur critique est survenue</h1>
          <p>Désolé, l'application a rencontré un problème inattendu.</p>
          {error && error.digest && <div className="digest">ID: {error.digest}</div>}
          <button onClick={reset}>Recharger la page</button>
        </div>
      </body>
    </html>
  );
}
