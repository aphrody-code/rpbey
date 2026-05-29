"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type ContentBlock } from "@/lib/types";
import { type ContentBlockInput } from "./actions";

interface ContentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ContentBlockInput) => Promise<void>;
  initialData: ContentBlock | null;
  loading: boolean;
}

export function ContentDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  loading,
}: ContentDialogProps) {
  const [formData, setFormData] = useState<ContentBlockInput>({
    slug: "",
    title: "",
    type: "text",
    content: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        slug: initialData.slug,
        title: initialData.title || "",
        type: initialData.type,
        content: initialData.content,
      });
    } else {
      setFormData({
        slug: "",
        title: "",
        type: "text",
        content: "",
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? "Modifier le contenu" : "Ajouter du contenu"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Slug (Clé unique)"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                fullWidth
                required
                disabled={!!initialData} // Prevent changing slug of existing content
                helperText="Identifiant unique utilisé dans le code (ex: about-intro)"
              />
              <TextField
                label="Titre (Admin)"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Type de contenu</InputLabel>
              <Select
                value={formData.type}
                label="Type de contenu"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="text">Texte Simple</MenuItem>
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="json">JSON (Données structurées)</MenuItem>
                <MenuItem value="html">HTML</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Contenu"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              fullWidth
              required
              multiline
              minRows={10}
              maxRows={25}
              sx={{ fontFamily: "monospace" }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
