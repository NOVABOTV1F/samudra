import { create } from "zustand";
import { uid } from "@/lib/utils";
import { titleFromPrompt } from "./parse";
import type { ActiveArtifact, ChatMessage, Conversation } from "./types";

const STORAGE_KEY = "samudra-studio-v1";
const MAX_CHATS = 40;
const MAX_MESSAGES = 80;

type StudioState = {
  hydrated: boolean;
  conversations: Conversation[];
  activeId: string | null;
  streamingId: string | null;
  artifact: ActiveArtifact | null;
  hydrate: () => void;
  newChat: () => string;
  setActive: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) => string;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  setStreaming: (id: string | null) => void;
  openArtifact: (artifact: ActiveArtifact) => void;
  closeArtifact: () => void;
  updateArtifactCode: (code: string) => void;
};

function snapshot(state: Pick<StudioState, "conversations" | "activeId">) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversations: state.conversations.slice(0, MAX_CHATS),
        activeId: state.activeId,
      }),
    );
  } catch {
    try {
      const trimmed = state.conversations.slice(0, 8).map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.imageUrl && message.imageUrl.length > 200_000
            ? { ...message, imageUrl: undefined, content: message.content || "(gambar tidak disimpan)" }
            : message,
        ),
      }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ conversations: trimmed, activeId: state.activeId }),
      );
    } catch {
      /* quota exhausted */
    }
  }
}

function load(): Pick<StudioState, "conversations" | "activeId"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], activeId: null };
    const parsed = JSON.parse(raw) as Partial<Pick<StudioState, "conversations" | "activeId">>;
    const conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
    return {
      conversations,
      activeId:
        parsed.activeId && conversations.some((chat) => chat.id === parsed.activeId)
          ? parsed.activeId
          : (conversations[0]?.id ?? null),
    };
  } catch {
    return { conversations: [], activeId: null };
  }
}

export const useStudioStore = create<StudioState>((set, get) => ({
  hydrated: false,
  conversations: [],
  activeId: null,
  streamingId: null,
  artifact: null,
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...load(), hydrated: true });
  },
  newChat: () => {
    const conversation: Conversation = {
      id: uid(),
      title: "Percakapan baru",
      messages: [],
      updatedAt: Date.now(),
    };
    set((state) => {
      const conversations = [conversation, ...state.conversations].slice(0, MAX_CHATS);
      const next = { conversations, activeId: conversation.id };
      snapshot(next);
      return { ...next, artifact: null };
    });
    return conversation.id;
  },
  setActive: (id) => {
    set((state) => {
      const next = { conversations: state.conversations, activeId: id };
      snapshot(next);
      return { activeId: id, artifact: null };
    });
  },
  deleteChat: (id) => {
    set((state) => {
      const conversations = state.conversations.filter((chat) => chat.id !== id);
      const activeId =
        state.activeId === id ? (conversations[0]?.id ?? null) : state.activeId;
      const next = { conversations, activeId };
      snapshot(next);
      return {
        ...next,
        artifact: state.artifact?.conversationId === id ? null : state.artifact,
      };
    });
  },
  addMessage: (conversationId, message) => {
    const id = message.id ?? uid();
    set((state) => {
      const conversations = state.conversations.map((chat) => {
        if (chat.id !== conversationId) return chat;
        const title =
          chat.messages.length === 0 && message.role === "user"
            ? titleFromPrompt(message.content)
            : chat.title;
        return {
          ...chat,
          title,
          updatedAt: Date.now(),
          messages: [
            ...chat.messages,
            {
              id,
              createdAt: Date.now(),
              role: message.role,
              content: message.content,
              imageUrl: message.imageUrl,
              error: message.error,
            },
          ].slice(-MAX_MESSAGES),
        };
      });
      const next = { conversations, activeId: state.activeId };
      snapshot(next);
      return next;
    });
    return id;
  },
  patchMessage: (conversationId, messageId, patch) => {
    set((state) => {
      const conversations = state.conversations.map((chat) => {
        if (chat.id !== conversationId) return chat;
        return {
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((message) =>
            message.id === messageId ? { ...message, ...patch } : message,
          ),
        };
      });
      const next = { conversations, activeId: state.activeId };
      snapshot(next);
      return next;
    });
  },
  setStreaming: (id) => set({ streamingId: id }),
  openArtifact: (artifact) => set({ artifact }),
  closeArtifact: () => set({ artifact: null }),
  updateArtifactCode: (code) =>
    set((state) =>
      state.artifact ? { artifact: { ...state.artifact, code } } : state,
    ),
}));

export function selectActiveChat(state: StudioState) {
  return state.conversations.find((chat) => chat.id === state.activeId) ?? null;
}
