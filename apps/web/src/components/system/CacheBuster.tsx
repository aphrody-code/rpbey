'use client';

import { useEffect } from 'react';

/**
 * Ce composant écoute les erreurs de chargement de chunks (fichiers JS).
 * C'est typique quand une nouvelle version est déployée et que l'utilisateur
 * navigue avec une version mise en cache qui cherche des fichiers qui n'existent plus.
 */
export function CacheBuster() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const isChunkError =
        /Loading chunk [\d]+ failed/.test(event.message) ||
        /Loading CSS chunk [\d]+ failed/.test(event.message) ||
        event.message?.includes('Importing a module script failed');

      if (isChunkError) {
        console.warn(
          'Chunk load error detected (New version deployed?). Forcing reload.',
        );
        // On empêche la boucle infinie si le reload échoue aussi
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('last_chunk_reload', String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return null;
}
