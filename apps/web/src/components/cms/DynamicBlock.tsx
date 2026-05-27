'use client';

import { Edit } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSession as useAuthSession } from '@/lib/auth-client'; // Using your client lib
import { upsertContent } from '@/server/actions/cms';

interface DynamicBlockProps {
  slug: string;
  initialContent?: string;
  fallback: string;
  editable?: boolean;
  className?: string; // For styling the container
}

export function DynamicBlock({
  slug,
  initialContent,
  fallback,
  className,
}: DynamicBlockProps) {
  const { data: session } = useAuthSession();
  const [content, setContent] = useState(initialContent || fallback);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [saving, setSaving] = useState(false);

  const isAdmin =
    session?.user?.role === 'admin' || session?.user?.role === 'superadmin';

  const handleSave = async () => {
    setSaving(true);
    await upsertContent(slug, editValue);
    setContent(editValue);
    setSaving(false);
    setIsEditing(false);
  };

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        '&:hover .edit-btn': { opacity: 1 },
      }}
    >
      {isAdmin && (
        <Tooltip title="Éditer le contenu">
          <IconButton
            className="edit-btn"
            size="small"
            onClick={() => {
              setEditValue(content);
              setIsEditing(true);
            }}
            sx={{
              position: 'absolute',
              top: -10,
              right: -10,
              opacity: 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper',
              boxShadow: 1,
              zIndex: 10,
              '&:hover': { bgcolor: 'primary.main', color: 'white' },
            }}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {/* Markdown Render */}
      <Box sx={{ '& p': { mb: 1.5 }, '& ul': { pl: 3, mb: 2 } }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </Box>
      {/* Edit Dialog */}
      <Dialog
        open={isEditing}
        onClose={() => setIsEditing(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Éditer : {slug}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={10}
            fullWidth
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace' }}
            helperText="Supporte le format Markdown (*gras*, # titre, - liste)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditing(false)}>Annuler</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
