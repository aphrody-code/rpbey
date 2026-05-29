"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { getPartsByExternalIds } from "@/server/actions/parts";
import { type Part } from "@/lib/types";

// --- Types ---

export interface BeySlot {
  blade: Part | null;
  overBlade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
  lockChip: Part | null;
  assistBlade: Part | null;
  nickname: string;
}

export type BuilderStep = "BLADE" | "OVER_BLADE" | "RATCHET" | "BIT" | "LOCK_CHIP" | "ASSIST_BLADE";

export interface DeckSummary {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

export interface BuilderState {
  deckId: string | null;
  deckName: string;
  isActive: boolean;
  beys: [BeySlot, BeySlot, BeySlot];
  activeSlotIndex: number;
  activeStep: BuilderStep;
  savedDecks: DeckSummary[];
  loadingDecks: boolean;
  mobileTab: "catalog" | "deck";
  history: Omit<BuilderState, "history" | "future" | "savedDecks" | "loadingDecks">[];
  future: Omit<BuilderState, "history" | "future" | "savedDecks" | "loadingDecks">[];
}

// --- Actions ---

export type BuilderAction =
  | { type: "SET_PART"; part: Part }
  | { type: "REMOVE_PART"; slotIndex: number; partType: BuilderStep }
  | { type: "SET_ACTIVE_SLOT"; slotIndex: number }
  | { type: "SET_ACTIVE_STEP"; step: BuilderStep }
  | { type: "SET_DECK_NAME"; name: string }
  | { type: "SET_IS_ACTIVE"; isActive: boolean }
  | { type: "SET_NICKNAME"; slotIndex: number; nickname: string }
  | { type: "LOAD_DECK"; deck: LoadDeckPayload }
  | { type: "NEW_DECK" }
  | { type: "SET_SAVED_DECKS"; decks: DeckSummary[] }
  | { type: "SET_LOADING_DECKS"; loading: boolean }
  | { type: "DELETE_DECK"; deckId: string }
  | { type: "SET_MOBILE_TAB"; tab: "catalog" | "deck" }
  | { type: "RESTORE_DRAFT"; draft: Partial<BuilderState> }
  | { type: "UNDO" }
  | { type: "REDO" };

export interface LoadDeckPayload {
  id: string;
  name: string;
  isActive: boolean;
  beys: Array<{
    blade: Part | null;
    overBlade?: Part | null;
    ratchet: Part | null;
    bit: Part | null;
    lockChip?: Part | null;
    assistBlade?: Part | null;
    nickname?: string;
  }>;
}

// --- Helpers ---

const emptySlot: BeySlot = {
  blade: null,
  overBlade: null,
  ratchet: null,
  bit: null,
  lockChip: null,
  assistBlade: null,
  nickname: "",
};

function createEmptyBeys(): [BeySlot, BeySlot, BeySlot] {
  return [{ ...emptySlot }, { ...emptySlot }, { ...emptySlot }];
}

/** Check if the blade in this slot is a CX blade */
export function isCXBlade(slot: BeySlot): boolean {
  return slot.blade?.system === "CX";
}

function getNextStep(slot: BeySlot): BuilderStep {
  if (!slot.blade) return "BLADE";
  if (isCXBlade(slot)) {
    if (!slot.lockChip) return "LOCK_CHIP";
    if (!slot.assistBlade) return "ASSIST_BLADE";
  }
  if (!slot.ratchet) return "RATCHET";
  if (!slot.bit) return "BIT";
  return "BLADE";
}

function isSlotComplete(slot: BeySlot): boolean {
  const baseComplete = !!slot.blade && !!slot.ratchet && !!slot.bit;
  if (!baseComplete) return false;
  if (isCXBlade(slot)) {
    return !!slot.lockChip && !!slot.assistBlade;
  }
  return true;
}

function stepKey(step: BuilderStep): keyof BeySlot {
  switch (step) {
    case "BLADE":
      return "blade";
    case "OVER_BLADE":
      return "overBlade";
    case "RATCHET":
      return "ratchet";
    case "BIT":
      return "bit";
    case "LOCK_CHIP":
      return "lockChip";
    case "ASSIST_BLADE":
      return "assistBlade";
  }
}

function stepToPartType(step: BuilderStep): string {
  return step; // Part.type matches the step name
}

// --- History Helper ---
const HISTORY_EXCLUDE_KEYS = ["history", "future", "savedDecks", "loadingDecks"] as const;

function omitHistoryKeys(
  state: BuilderState,
): Omit<BuilderState, (typeof HISTORY_EXCLUDE_KEYS)[number]> {
  return Object.fromEntries(
    Object.entries(state).filter(([k]) => !(HISTORY_EXCLUDE_KEYS as readonly string[]).includes(k)),
  ) as Omit<BuilderState, (typeof HISTORY_EXCLUDE_KEYS)[number]>;
}

function pushHistory(state: BuilderState): BuilderState {
  const snapshot = omitHistoryKeys(state);
  return {
    ...state,
    history: [snapshot, ...state.history].slice(0, 50), // Limit history to 50 steps
    future: [], // Clear future on new action
  };
}

// --- Initial State ---

export const initialState: BuilderState = {
  deckId: null,
  deckName: "",
  isActive: false,
  beys: createEmptyBeys(),
  activeSlotIndex: 0,
  activeStep: "BLADE",
  savedDecks: [],
  loadingDecks: false,
  mobileTab: "catalog",
  history: [],
  future: [],
};

// --- Reducer ---

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "UNDO": {
      if (state.history.length === 0) return state;
      const [previous, ...remainingHistory] = state.history;
      const current = omitHistoryKeys(state);
      return {
        ...state,
        ...previous,
        history: remainingHistory,
        future: [current, ...state.future],
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...remainingFuture] = state.future;
      const current = omitHistoryKeys(state);
      return {
        ...state,
        ...next,
        history: [current, ...state.history],
        future: remainingFuture,
      };
    }

    case "SET_PART": {
      const nextState = pushHistory(state);
      const newBeys: [BeySlot, BeySlot, BeySlot] = [
        { ...state.beys[0] },
        { ...state.beys[1] },
        { ...state.beys[2] },
      ];
      const key = stepKey(state.activeStep);
      const idx = state.activeSlotIndex as 0 | 1 | 2;

      // Validate part type matches the step
      if (action.part.type !== stepToPartType(state.activeStep)) return state;

      newBeys[idx] = {
        ...newBeys[idx],
        [key]: action.part,
      };

      // If switching away from a CX blade, clear CX-specific parts
      if (state.activeStep === "BLADE" && !isCXBlade(newBeys[idx])) {
        newBeys[idx] = {
          ...newBeys[idx],
          overBlade: null,
          lockChip: null,
          assistBlade: null,
        };
      }

      // Auto-advance logic
      const updatedSlot = newBeys[idx];
      let nextSlotIndex = state.activeSlotIndex;
      let nextStep = state.activeStep;

      if (isSlotComplete(updatedSlot)) {
        // Find next incomplete slot
        const nextIncomplete = newBeys.findIndex((s, i) => i > idx && !isSlotComplete(s)) as
          | 0
          | 1
          | 2
          | -1;
        if (nextIncomplete !== -1) {
          nextSlotIndex = nextIncomplete;
          nextStep = getNextStep(newBeys[nextIncomplete]);
        } else {
          // Check earlier slots
          const earlier = newBeys.findIndex((s) => !isSlotComplete(s)) as 0 | 1 | 2 | -1;
          if (earlier !== -1) {
            nextSlotIndex = earlier;
            nextStep = getNextStep(newBeys[earlier]);
          } else {
            // All complete, stay
            nextStep = "BLADE";
          }
        }
      } else {
        nextStep = getNextStep(updatedSlot);
      }

      return {
        ...nextState,
        beys: newBeys,
        activeSlotIndex: nextSlotIndex,
        activeStep: nextStep,
      };
    }

    case "REMOVE_PART": {
      const nextState = pushHistory(state);
      const newBeys: [BeySlot, BeySlot, BeySlot] = [
        { ...state.beys[0] },
        { ...state.beys[1] },
        { ...state.beys[2] },
      ];
      const rmIdx = action.slotIndex as 0 | 1 | 2;
      const rmKey = stepKey(action.partType);
      newBeys[rmIdx] = {
        ...newBeys[rmIdx],
        [rmKey]: null,
      };
      // If removing the blade, also clear CX parts
      if (action.partType === "BLADE") {
        newBeys[rmIdx] = {
          ...newBeys[rmIdx],
          overBlade: null,
          lockChip: null,
          assistBlade: null,
        };
      }
      return {
        ...nextState,
        beys: newBeys,
        activeSlotIndex: action.slotIndex,
        activeStep: action.partType,
      };
    }

    case "SET_ACTIVE_SLOT": {
      const saIdx = action.slotIndex as 0 | 1 | 2;
      const slot = state.beys[saIdx];
      return {
        ...state,
        activeSlotIndex: saIdx,
        activeStep: getNextStep(slot),
      };
    }

    case "SET_ACTIVE_STEP":
      return { ...state, activeStep: action.step };

    case "SET_DECK_NAME":
      return { ...state, deckName: action.name };

    case "SET_IS_ACTIVE":
      return { ...state, isActive: action.isActive };

    case "SET_NICKNAME": {
      const nextState = pushHistory(state);
      const newBeys: [BeySlot, BeySlot, BeySlot] = [
        { ...state.beys[0] },
        { ...state.beys[1] },
        { ...state.beys[2] },
      ];
      const nnIdx = action.slotIndex as 0 | 1 | 2;
      newBeys[nnIdx] = {
        ...newBeys[nnIdx],
        nickname: action.nickname,
      };
      return { ...nextState, beys: newBeys };
    }

    case "LOAD_DECK": {
      const nextState = pushHistory(state);
      const newBeys = createEmptyBeys();
      action.deck.beys.forEach((bey, i) => {
        if (i < 3) {
          newBeys[i as 0 | 1 | 2] = {
            blade: bey.blade ?? null,
            overBlade: bey.overBlade ?? null,
            ratchet: bey.ratchet ?? null,
            bit: bey.bit ?? null,
            lockChip: bey.lockChip ?? null,
            assistBlade: bey.assistBlade ?? null,
            nickname: bey.nickname || "",
          };
        }
      });
      const firstIncomplete = newBeys.findIndex((s) => !isSlotComplete(s)) as 0 | 1 | 2 | -1;
      const ldIdx = (firstIncomplete !== -1 ? firstIncomplete : 0) as 0 | 1 | 2;
      return {
        ...nextState,
        deckId: action.deck.id,
        deckName: action.deck.name,
        isActive: action.deck.isActive,
        beys: newBeys,
        activeSlotIndex: ldIdx,
        activeStep: getNextStep(newBeys[ldIdx]),
      };
    }

    case "NEW_DECK":
      return {
        ...pushHistory(state),
        deckId: null,
        deckName: "",
        isActive: false,
        beys: createEmptyBeys(),
        activeSlotIndex: 0,
        activeStep: "BLADE",
      };

    case "SET_SAVED_DECKS":
      return { ...state, savedDecks: action.decks };

    case "SET_LOADING_DECKS":
      return { ...state, loadingDecks: action.loading };

    case "DELETE_DECK":
      return {
        ...state,
        savedDecks: state.savedDecks.filter((d) => d.id !== action.deckId),
        ...(state.deckId === action.deckId
          ? {
              deckId: null,
              deckName: "",
              isActive: false,
              beys: createEmptyBeys(),
              activeSlotIndex: 0,
              activeStep: "BLADE" as BuilderStep,
            }
          : {}),
      };

    case "SET_MOBILE_TAB":
      return { ...state, mobileTab: action.tab };

    case "RESTORE_DRAFT":
      return { ...state, ...action.draft };

    default:
      return state;
  }
}

// --- localStorage persistence ---

const LS_KEY = "rpb-builder-draft";

interface LocalDraft {
  deckId: string | null;
  deckName: string;
  isActive: boolean;
  beys: [BeySlot, BeySlot, BeySlot];
}

function saveDraft(state: BuilderState) {
  try {
    const draft: LocalDraft = {
      deckId: state.deckId,
      deckName: state.deckName,
      isActive: state.isActive,
      beys: state.beys,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(draft));
  } catch {
    /* quota exceeded or SSR */
  }
}

function loadDraft(): Partial<BuilderState> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const draft: LocalDraft = JSON.parse(raw);
    // Validate structure
    if (!Array.isArray(draft.beys) || draft.beys.length !== 3) return null;
    const hasParts = draft.beys.some(
      (b) => b.blade || b.ratchet || b.bit || b.lockChip || b.assistBlade,
    );
    if (!hasParts && !draft.deckName) return null;
    // Ensure CX fields exist (migration from old drafts)
    for (const bey of draft.beys) {
      if (!("overBlade" in bey)) (bey as BeySlot).overBlade = null;
      if (!("lockChip" in bey)) (bey as BeySlot).lockChip = null;
      if (!("assistBlade" in bey)) (bey as BeySlot).assistBlade = null;
    }
    // Find first incomplete slot
    const firstIncomplete = draft.beys.findIndex((s) => !isSlotComplete(s));
    const idx = (firstIncomplete !== -1 ? firstIncomplete : 0) as 0 | 1 | 2;
    const slot = draft.beys[idx];
    return {
      deckId: draft.deckId,
      deckName: draft.deckName,
      isActive: draft.isActive,
      beys: draft.beys,
      activeSlotIndex: idx,
      activeStep: getNextStep(slot),
    };
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}

// --- URL Sharing Helper ---
function encodeState(state: BuilderState): string {
  const data = {
    n: state.deckName,
    b: state.beys.map((s) => ({
      b: s.blade?.externalId,
      o: s.overBlade?.externalId,
      r: s.ratchet?.externalId,
      t: s.bit?.externalId,
      l: s.lockChip?.externalId,
      a: s.assistBlade?.externalId,
    })),
  };
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

interface SharedSlot {
  b?: string;
  o?: string;
  r?: string;
  t?: string;
  l?: string;
  a?: string;
}

interface SharedDeck {
  n?: string;
  b?: SharedSlot[];
}

function decodeShare(code: string): SharedDeck | null {
  try {
    const data = JSON.parse(atob(code)) as SharedDeck;
    if (!data || !Array.isArray(data.b)) return null;
    return data;
  } catch {
    return null;
  }
}

// --- Context ---

interface BuilderContextValue {
  state: BuilderState;
  dispatch: Dispatch<BuilderAction>;
  usedPartIds: Set<string>;
  usedPartNames: Set<string>;
  canUndo: boolean;
  canRedo: boolean;
  shareUrl: string;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, initialState);
  const hasRestoredDraft = useRef(false);
  // Restore from a ?share= link (priority) or the localStorage draft on mount.
  useEffect(() => {
    if (hasRestoredDraft.current) return;
    hasRestoredDraft.current = true;

    const shareCode = new URLSearchParams(window.location.search).get("share");
    if (shareCode) {
      const shared = decodeShare(shareCode);
      if (shared) {
        const ids = (shared.b ?? []).flatMap((s) =>
          [s.b, s.o, s.r, s.t, s.l, s.a].filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          ),
        );
        getPartsByExternalIds(ids)
          .then((parts) => {
            const byExt = new Map(parts.map((p) => [p.externalId, p as Part]));
            const beys = (shared.b ?? []).slice(0, 3).map((s) => ({
              blade: s.b ? (byExt.get(s.b) ?? null) : null,
              overBlade: s.o ? (byExt.get(s.o) ?? null) : null,
              ratchet: s.r ? (byExt.get(s.r) ?? null) : null,
              bit: s.t ? (byExt.get(s.t) ?? null) : null,
              lockChip: s.l ? (byExt.get(s.l) ?? null) : null,
              assistBlade: s.a ? (byExt.get(s.a) ?? null) : null,
              nickname: "",
            }));
            // id '' (falsy) → treated as a new, unsaved deck (POST on save).
            dispatch({
              type: "LOAD_DECK",
              deck: {
                id: "",
                name: shared.n ?? "",
                isActive: false,
                beys,
              },
            });
          })
          .catch(() => {
            /* fall back to empty builder */
          });
        return;
      }
    }

    const draft = loadDraft();
    if (draft) {
      dispatch({ type: "RESTORE_DRAFT", draft });
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        if (key === "z") {
          if (e.shiftKey) dispatch({ type: "REDO" });
          else dispatch({ type: "UNDO" });
          e.preventDefault();
        } else if (key === "y") {
          dispatch({ type: "REDO" });
          e.preventDefault();
        }
      }

      if (["1", "2", "3"].includes(e.key)) {
        dispatch({
          type: "SET_ACTIVE_SLOT",
          slotIndex: parseInt(e.key, 10) - 1,
        });
      }

      if (key === "b") dispatch({ type: "SET_ACTIVE_STEP", step: "BLADE" });
      if (key === "r") dispatch({ type: "SET_ACTIVE_STEP", step: "RATCHET" });
      if (key === "t") dispatch({ type: "SET_ACTIVE_STEP", step: "BIT" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Persist to localStorage on every relevant change (skip first render)
  const isFirstPersist = useRef(true);
  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }
    saveDraft(state);
  }, [state.beys, state.deckName, state.deckId, state.isActive, state]);

  const usedPartIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bey of state.beys) {
      if (bey.blade) ids.add(bey.blade.id);
      if (bey.overBlade) ids.add(bey.overBlade.id);
      if (bey.ratchet) ids.add(bey.ratchet.id);
      if (bey.bit) ids.add(bey.bit.id);
      if (bey.lockChip?.name.toLowerCase().includes("metal")) ids.add(bey.lockChip.id);
      if (bey.assistBlade) ids.add(bey.assistBlade.id);
    }
    return ids;
  }, [state.beys]);

  // Also track by name to prevent duplicates with different IDs
  const usedPartNames = useMemo(() => {
    const names = new Set<string>();
    for (const bey of state.beys) {
      if (bey.blade) names.add(bey.blade.name);
      if (bey.overBlade) names.add(bey.overBlade.name);
      if (bey.ratchet) names.add(bey.ratchet.name);
      if (bey.bit) names.add(bey.bit.name);
      if (bey.lockChip?.name.toLowerCase().includes("metal")) names.add(bey.lockChip.name);
      if (bey.assistBlade) names.add(bey.assistBlade.name);
    }
    return names;
  }, [state.beys]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin + window.location.pathname;
    const code = encodeState(state);
    return code ? `${baseUrl}?share=${code}` : baseUrl;
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      usedPartIds,
      usedPartNames,
      canUndo: state.history.length > 0,
      canRedo: state.future.length > 0,
      shareUrl,
    }),
    [state, usedPartIds, usedPartNames, shareUrl],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used within BuilderProvider");
  return ctx;
}
