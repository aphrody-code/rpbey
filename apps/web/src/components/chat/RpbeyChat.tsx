"use client";

import { Box, IconButton, InputBase } from "@mui/material";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type ChatAnswer, type ChatSource, STARTER_PROMPTS } from "@/lib/chat-nlp";

/**
 * Chat RAG « Rpbey » — style Gemini app (gradient signature `--rpb-gradient-ai`, sparkle
 * 4-couleurs, bulles arrondies, prompt-bar pill à bordure gradient au focus, thinking-dots),
 * mappé sur les tokens `--rpb-*`. Branché sur `POST /api/chat` (NLP algorithmique + retrieval
 * hybride, ZÉRO LLM). Aucun loader vide : état initial = sparkle + chips de départ ;
 * pendant la réponse = thinking-dots animés (indicateur réel). Motion M3 (emphasized-decel).
 */

// Token M3 motion (emphasized-decelerate — apparition de bulle).
const M3_DECEL = [0.05, 0.7, 0.1, 1] as const;

interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  followups?: string[];
  error?: boolean;
}

const CATEGORY_EMOJI: Record<string, string> = {
  product: "📦",
  part: "⚙️",
  tournament: "🏆",
  blader: "👤",
  lexicon: "📖",
  combo: "🌀",
  anime: "📺",
  meta: "📊",
  discussion: "💬",
  page: "📄",
  frame: "🖼️",
  site: "🌐",
};

/** Sparkle 4-branches gradient (moment d'identité IA). */
function GeminiSparkle({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <radialGradient id="rpb-sparkle-grad" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="40%" stopColor="#9168C0" />
          <stop offset="75%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#FBBC04" />
        </radialGradient>
      </defs>
      <path
        d="M12 0 C12 6 6 6 0 12 C6 12 12 12 12 24 C12 12 18 12 24 12 C18 12 12 12 12 0 Z"
        fill="url(#rpb-sparkle-grad)"
      />
    </svg>
  );
}

function ThinkingDots() {
  return (
    <Box
      sx={{
        display: "inline-flex",
        gap: "5px",
        alignItems: "center",
        py: 0.75,
        px: 0.5,
        "& span": {
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--rpb-gradient-ai)",
          animation: "rpb-think 1.2s infinite ease-in-out both",
        },
        "& span:nth-of-type(1)": { animationDelay: "-0.32s" },
        "& span:nth-of-type(2)": { animationDelay: "-0.16s" },
        "@keyframes rpb-think": {
          "0%,80%,100%": { transform: "scale(0.6)", opacity: 0.4 },
          "40%": { transform: "scale(1)", opacity: 1 },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& span": { animation: "none", opacity: 0.7 },
        },
      }}
    >
      <span />
      <span />
      <span />
    </Box>
  );
}

/** Carte de source citée (résultat RAG). */
function SourceCard({ s }: { s: ChatSource }) {
  return (
    <Box
      component={Link}
      href={s.url}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        textDecoration: "none",
        minWidth: 0,
        maxWidth: 230,
        px: 1,
        py: 0.75,
        borderRadius: "14px",
        bgcolor: "var(--rpb-surface-low)",
        border: "1px solid var(--rpb-divider)",
        color: "var(--rpb-text)",
        transition: "transform 200ms cubic-bezier(0.2,0,0,1), background-color 200ms",
        "&:hover": { transform: "translateY(-2px)", bgcolor: "var(--rpb-surface-main)" },
      }}
    >
      {s.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.thumbnail}
          alt=""
          width={28}
          height={28}
          style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <Box component="span" sx={{ fontSize: 16, flexShrink: 0 }}>
          {CATEGORY_EMOJI[s.category] ?? "•"}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {s.title}
        </Box>
        {s.subtitle && (
          <Box
            sx={{
              fontSize: 11,
              color: "var(--rpb-text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {s.subtitle}
          </Box>
        )}
      </Box>
    </Box>
  );
}

const MD_COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <Box
      component={Link}
      href={href ?? "#"}
      sx={{
        color: "var(--rpb-ai-mid)",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {children}
    </Box>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <Box component="p" sx={{ m: 0, mb: 1, "&:last-child": { mb: 0 } }}>
      {children}
    </Box>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="code"
      sx={{
        px: 0.6,
        py: 0.1,
        borderRadius: 1,
        bgcolor: "var(--rpb-surface-low)",
        fontSize: "0.85em",
        fontWeight: 700,
        color: "var(--rpb-text)",
      }}
    >
      {children}
    </Box>
  ),
};

function MessageBubble({ msg, reduce }: { msg: Msg; reduce: boolean | null }) {
  const isUser = msg.role === "user";
  return (
    <m.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: M3_DECEL }}
      style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          maxWidth: "100%",
          flexDirection: isUser ? "row-reverse" : "row",
        }}
      >
        {!isUser && (
          <Box
            sx={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              p: "2px",
              background: "var(--rpb-gradient-ai)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                bgcolor: "var(--rpb-surface-main)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <GeminiSparkle size={17} />
            </Box>
          </Box>
        )}
        <Box>
          <Box
            sx={{
              maxWidth: { xs: "78vw", sm: 460 },
              px: 1.75,
              py: 1.1,
              fontSize: 14.5,
              lineHeight: 1.55,
              borderRadius: "22px",
              borderBottomRightRadius: isUser ? "6px" : "22px",
              borderBottomLeftRadius: isUser ? "22px" : "6px",
              bgcolor: isUser ? "var(--rpb-surface-high)" : "var(--rpb-surface-main)",
              color: msg.error ? "var(--rpb-text-secondary)" : "var(--rpb-text)",
              border: isUser ? "none" : "1px solid var(--rpb-divider)",
              "& ul": { m: 0, pl: 2.25 },
              "& li": { mb: 0.5 },
              "& strong": { fontWeight: 700 },
            }}
          >
            {isUser ? (
              msg.content
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {msg.content}
              </ReactMarkdown>
            )}
          </Box>
          {/* Sources citées */}
          {msg.sources && msg.sources.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
              {msg.sources.map((s) => (
                <SourceCard key={s.url} s={s} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </m.div>
  );
}

export interface RpbeyChatProps {
  /** Question pré-remplie / lancée à l'ouverture (depuis la barre de recherche). */
  initialQuery?: string;
  /** Hauteur du panneau (drawer plein écran mobile, fenêtre desktop). */
  height?: string | number;
}

export function RpbeyChat({ initialQuery, height = "100%" }: RpbeyChatProps) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text.length < 2 || busy) return;
      const userMsg: Msg = { id: ++idRef.current, role: "user", content: text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const json = (await res.json()) as { ok: boolean; data?: ChatAnswer };
        const a = json.data;
        setMessages((m) => [
          ...m,
          {
            id: ++idRef.current,
            role: "assistant",
            content: a?.answerMd ?? "Le savoir vacille un instant. Réessaie.",
            sources: a?.sources,
            followups: a?.followups,
            error: !json.ok || !a,
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: ++idRef.current,
            role: "assistant",
            content: "Connexion interrompue. Repose ta question.",
            error: true,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  // Lancement auto si une question initiale est fournie (une seule fois).
  useEffect(() => {
    if (initialQuery && !startedRef.current) {
      startedRef.current = true;
      void send(initialQuery);
    }
  }, [initialQuery, send]);

  // Auto-scroll vers le bas à chaque nouveau message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const lastFollowups =
    !busy && messages.length > 0 && messages[messages.length - 1]!.role === "assistant"
      ? messages[messages.length - 1]!.followups
      : undefined;
  const canSend = input.trim().length > 0 && !busy;
  const empty = messages.length === 0;

  return (
    <LazyMotion features={domAnimation}>
      <Box
        sx={{
          height,
          display: "flex",
          flexDirection: "column",
          bgcolor: "var(--rpb-bg)",
          color: "var(--rpb-text)",
        }}
      >
        {/* Messages */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
          {empty ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 2,
              }}
            >
              <GeminiSparkle size={56} />
              <Box>
                <Box sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Demande à Rpbey
                </Box>
                <Box
                  sx={{ fontSize: 14, color: "var(--rpb-text-secondary)", mt: 0.5, maxWidth: 320 }}
                >
                  L'expert omniscient du Beyblade : combos, méta, toupies, persos, tournois, prix.
                </Box>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  justifyContent: "center",
                  maxWidth: 440,
                }}
              >
                {STARTER_PROMPTS.map((p, i) => (
                  <Box
                    key={p}
                    component="button"
                    onClick={() => send(p)}
                    sx={{
                      cursor: "pointer",
                      borderRadius: "18px",
                      px: 1.75,
                      py: 1,
                      fontSize: 13.5,
                      color: "var(--rpb-text)",
                      bgcolor: "var(--rpb-surface-low)",
                      border: i === 0 ? "1.5px solid transparent" : "1px solid var(--rpb-divider)",
                      ...(i === 0 && {
                        background:
                          "linear-gradient(var(--rpb-surface-low),var(--rpb-surface-low)) padding-box, var(--rpb-gradient-ai) border-box",
                      }),
                      transition: "transform 200ms cubic-bezier(0.2,0,0,1)",
                      "&:hover": { transform: "translateY(-2px)" },
                    }}
                  >
                    {p}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} reduce={reduce} />
              ))}
              {busy && (
                <Box sx={{ display: "flex", gap: 1.25 }}>
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      p: "2px",
                      background: "var(--rpb-gradient-ai)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        bgcolor: "var(--rpb-surface-main)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <GeminiSparkle size={17} />
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: "var(--rpb-surface-main)",
                      border: "1px solid var(--rpb-divider)",
                      borderRadius: "22px",
                      borderBottomLeftRadius: "6px",
                      px: 1.5,
                    }}
                  >
                    <ThinkingDots />
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Relances suggérées */}
        {lastFollowups && lastFollowups.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 2, pb: 1 }}>
            {lastFollowups.map((f) => (
              <Box
                key={f}
                component="button"
                onClick={() => send(f)}
                sx={{
                  cursor: "pointer",
                  borderRadius: "16px",
                  px: 1.5,
                  py: 0.6,
                  fontSize: 12.5,
                  color: "var(--rpb-text-secondary)",
                  bgcolor: "transparent",
                  border: "1px solid var(--rpb-divider)",
                  transition: "all 200ms cubic-bezier(0.2,0,0,1)",
                  "&:hover": { color: "var(--rpb-text)", borderColor: "var(--rpb-ai-mid)" },
                }}
              >
                {f}
              </Box>
            ))}
          </Box>
        )}

        {/* Prompt bar */}
        <Box sx={{ p: 1.5, pt: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
              gap: 1,
              minHeight: 52,
              px: 1,
              pl: 2,
              py: 0.5,
              borderRadius: "26px",
              bgcolor: "var(--rpb-surface-high)",
              border: "1.5px solid var(--rpb-divider)",
              transition: "border-color 200ms cubic-bezier(0.2,0,0,1)",
              "&:focus-within": {
                borderColor: "transparent",
                background:
                  "linear-gradient(var(--rpb-surface-high),var(--rpb-surface-high)) padding-box, var(--rpb-gradient-ai) border-box",
              },
            }}
          >
            <InputBase
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canSend) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Pose ta question Beyblade…"
              multiline
              maxRows={5}
              sx={{
                flex: 1,
                color: "var(--rpb-text)",
                fontSize: 15,
                py: 0.75,
                "& textarea::placeholder": { color: "var(--rpb-text-tertiary)", opacity: 1 },
              }}
            />
            <IconButton
              onClick={() => send(input)}
              disabled={!canSend}
              aria-label="Envoyer"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                color: "#fff",
                background: canSend ? "var(--rpb-gradient-ai)" : "var(--rpb-surface-highest)",
                transition: "background 250ms cubic-bezier(0.05,0.7,0.1,1), transform 150ms",
                "&:hover": { transform: canSend ? "scale(1.06)" : "none" },
                "&.Mui-disabled": { color: "var(--rpb-text-tertiary)" },
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </IconButton>
          </Box>
          <Box
            sx={{
              textAlign: "center",
              fontSize: 10.5,
              color: "var(--rpb-text-tertiary)",
              mt: 0.75,
            }}
          >
            Rpbey synthétise le savoir RPB (wiki, méta, combos, tournois, discussions). Vérifie les
            sources.
          </Box>
        </Box>
      </Box>
    </LazyMotion>
  );
}
