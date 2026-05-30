"use client";

import {
  AddPhotoAlternate,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  Link as LinkIcon,
  LinkOff,
  Redo,
  Title,
  Undo,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  useTheme,
} from "@mui/material";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, minHeight = 300 }: RichTextEditorProps) {
  const theme = useTheme();
  const { showToast } = useToast();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkDialogOpen) {
      const id = setTimeout(() => linkInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [linkDialogOpen]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
      }),
      ImageExtension.configure({
        inline: true,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 16px; outline: none; font-family: ${theme.typography.fontFamily}; color: ${theme.palette.text.primary};`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Image Upload Handler
  const addImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (input.files?.length) {
        const file = input.files[0];
        if (!file) return; // Null check
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "content"); // images de contenu (bio) → scope CDN dédié

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(data?.error || "Upload échoué");
          }
          if (data?.url && editor) {
            editor.chain().focus().setImage({ src: data.url }).run();
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erreur lors de l'upload de l'image";
          showToast(message, "error");
        }
      }
    };
    input.click();
  }, [editor, showToast]);

  const setLink = useCallback(() => {
    if (linkUrl) {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    } else {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkDialog = () => {
    const previousUrl = editor?.getAttributes("link").href;
    setLinkUrl(previousUrl || "");
    setLinkDialogOpen(true);
  };

  if (!editor) return null;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        transition: "box-shadow 0.2s",
        "&:focus-within": {
          borderColor: "primary.main",
          boxShadow: `0 0 0 2px ${theme.palette.primary.main}33`,
        },
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          p: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
          flexWrap: "wrap",
        }}
      >
        <Tooltip title="Gras">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBold().run()}
            color={editor.isActive("bold") ? "primary" : "default"}
          >
            <FormatBold fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italique">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            color={editor.isActive("italic") ? "primary" : "default"}
          >
            <FormatItalic fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Titre 2">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            color={editor.isActive("heading", { level: 2 }) ? "primary" : "default"}
          >
            <Title fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Aligner à gauche">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            color={editor.isActive({ textAlign: "left" }) ? "primary" : "default"}
          >
            <FormatAlignLeft fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Centrer">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            color={editor.isActive({ textAlign: "center" }) ? "primary" : "default"}
          >
            <FormatAlignCenter fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Liste à puces">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            color={editor.isActive("bulletList") ? "primary" : "default"}
          >
            <FormatListBulleted fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Liste numérotée">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            color={editor.isActive("orderedList") ? "primary" : "default"}
          >
            <FormatListNumbered fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Lien">
          <IconButton
            size="small"
            onClick={openLinkDialog}
            color={editor.isActive("link") ? "primary" : "default"}
          >
            <LinkIcon
              sx={{
                fontSize: "small",
              }}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title="Retirer le lien">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
          >
            <LinkOff fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Image">
          <IconButton size="small" onClick={addImage}>
            <AddPhotoAlternate fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton
          size="small"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo fontSize="small" />
        </IconButton>
      </Box>
      {/* Content */}
      <EditorContent editor={editor} />
      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)}>
        <DialogTitle>Ajouter un lien</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={linkInputRef}
            margin="dense"
            label="URL"
            type="url"
            fullWidth
            variant="outlined"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Annuler</Button>
          <Button onClick={setLink} variant="contained">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
