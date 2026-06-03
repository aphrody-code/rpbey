"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-container">
      <style>{`
        .error-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background-color: #0a0a0f;
          color: #ffffff;
          padding: 1.5rem;
          text-align: center;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        h1 {
          color: #ef4444;
          font-size: 2rem;
          font-weight: bold;
          margin: 0;
        }
        p {
          color: #a1a1aa;
          font-size: 1.1rem;
          margin: 0;
        }
        .digest {
          font-family: monospace;
          font-size: 0.85rem;
          color: #71717a;
          background-color: #1a1a24;
          padding: 0.5rem;
          border-radius: 6px;
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
          margin-top: 1rem;
        }
        button:hover {
          opacity: 0.9;
        }
      `}</style>
      <h1>Une erreur est survenue</h1>
      <p>Désolé, impossible d'afficher cette page pour le moment.</p>
      {error.digest && <div className="digest">ID: {error.digest}</div>}
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
