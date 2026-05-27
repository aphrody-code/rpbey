'use client';

import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useCallback, useEffect, useState } from 'react';
import {
  DataTable,
  PageHeader,
  useConfirmDialog,
  useToast,
} from '@/components/ui';
import { type Column } from '@/components/ui/DataTable';
import { type ContentBlock } from '@/lib/types';
import {
  type ContentBlockInput,
  createContentBlock,
  deleteContentBlock,
  getContentBlocks,
  updateContentBlock,
} from './actions';
import { ContentDialog } from './ContentDialog';

export default function AdminContentPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContentBlocks();
      setBlocks(data);
    } catch {
      showToast('Erreur lors de la récupération du contenu', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleAdd = () => {
    setSelectedBlock(null);
    setDialogOpen(true);
  };

  const handleEdit = (block: ContentBlock) => {
    setSelectedBlock(block);
    setDialogOpen(true);
  };

  const handleDelete = async (block: ContentBlock) => {
    const confirmed = await confirm({
      title: 'Supprimer le contenu',
      message: `Êtes-vous sûr de vouloir supprimer "${block.title}" (${block.slug}) ?`,
      confirmText: 'Supprimer',
      confirmColor: 'error',
    });

    if (confirmed) {
      try {
        await deleteContentBlock(block.id);
        showToast('Contenu supprimé avec succès', 'success');
        fetchBlocks();
      } catch {
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const handleSubmit = async (data: ContentBlockInput) => {
    setSubmitting(true);
    try {
      if (data.type === 'json') {
        try {
          JSON.parse(data.content);
        } catch {
          showToast('JSON invalide', 'error');
          setSubmitting(false);
          return;
        }
      }

      if (selectedBlock) {
        await updateContentBlock(selectedBlock.id, data);
        showToast('Contenu mis à jour', 'success');
      } else {
        await createContentBlock(data);
        showToast('Contenu créé', 'success');
      }
      setDialogOpen(false);
      fetchBlocks();
    } catch {
      showToast("Erreur lors de l'enregistrement", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<ContentBlock>[] = [
    {
      id: 'title',
      label: 'Titre / Slug',
      render: (row) => (
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 'bold',
            }}
          >
            {row.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: 'monospace',
            }}
          >
            {row.slug}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      render: (row) => {
        const typeLabels: Record<string, string> = {
          text: 'Texte',
          markdown: 'Markdown',
          json: 'JSON',
          html: 'HTML',
        };
        return (
          <Chip
            label={typeLabels[row.type] || row.type}
            size="small"
            color={
              row.type === 'json'
                ? 'warning'
                : row.type === 'markdown'
                  ? 'info'
                  : 'default'
            }
            variant="outlined"
          />
        );
      },
    },
    {
      id: 'content',
      label: 'Aperçu',
      render: (row) => (
        <Typography
          variant="body2"
          noWrap
          sx={{
            color: 'text.secondary',
            maxWidth: 300,
          }}
        >
          {row.content}
        </Typography>
      ),
    },
    {
      id: 'updatedAt',
      label: 'Modifié le',
      render: (row) => new Date(row.updatedAt).toLocaleDateString('fr-FR'),
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title="Modifier">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              size="small"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              size="small"
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Contenu du Site"
        description="Gérez les textes et configurations dynamiques du site"
        actionLabel="Ajouter du contenu"
        onAction={handleAdd}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <DataTable
          columns={columns}
          rows={blocks}
          emptyMessage="Aucun contenu trouvé."
        />
      )}

      <ContentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedBlock}
        loading={submitting}
      />
    </Box>
  );
}
