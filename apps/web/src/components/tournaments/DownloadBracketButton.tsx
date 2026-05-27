'use client';

import { Download } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useState } from 'react';
import { toast } from 'sonner';

interface DownloadBracketButtonProps {
  targetId: string;
  fileName?: string;
}

export function DownloadBracketButton({
  targetId,
  fileName = 'tournament-export',
}: DownloadBracketButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const element = document.getElementById(targetId);
    if (!element) {
      toast.error(
        'Contenu introuvable (Vérifiez que le tableau/classement est visible)',
      );
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Génération de l'image...");

    try {
      // Add a small delay to ensure rendering
      await new Promise((r) => setTimeout(r, 100));

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: '#121212', // Dark background by default
        scale: 2, // Retina quality
        logging: false,
        allowTaint: true,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();

      toast.success('Image téléchargée avec succès !', { id: toastId });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error("Erreur lors de l'export de l'image", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outlined"
      startIcon={<Download />}
      onClick={handleDownload}
      disabled={loading}
      fullWidth
      sx={{
        borderRadius: 3,
        py: 1.5,
        fontWeight: 800,
        borderColor: 'divider',
        mt: 2,
      }}
    >
      {loading ? 'GÉNÉRATION...' : 'EXPORTER LA VUE'}
    </Button>
  );
}
