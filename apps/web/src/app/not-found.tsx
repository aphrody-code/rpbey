"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notfound-container">
      <style>{`
        .notfound-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0a0a0f;
          color: #ffffff;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        .content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1.5rem;
          padding: 2rem;
        }
        h1 {
          font-size: 6rem;
          font-weight: 900;
          color: #ef4444;
          margin: 0;
          line-height: 1;
        }
        h2 {
          font-size: 1.75rem;
          margin: 0;
          color: #e4e4e7;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s;
          margin-top: 1rem;
        }
        .btn:hover {
          opacity: 0.9;
        }
      `}</style>
      <div className="content">
        <h1>404</h1>
        <h2>Page introuvable</h2>
        <Link href="/" className="btn">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
