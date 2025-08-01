import { create } from 'zustand';

import { DEFAULT_CHAT_TITLE } from '@/consts';
import {
  ChatWithMessages as ServerChatWithMessages,
  createChat,
  deleteChat,
  getAllChats,
  updateChat,
} from '@/lib/api-client';
import { initializeChat } from '@/lib/utils/chat';
import { websocketService } from '@/lib/websocket';
import { type ChatWithMessages } from '@/types';

interface ChatState {
  chats: ChatWithMessages[];
  currentChatSessionId: string | null;
  isLoadingChats: boolean;
}

interface ChatActions {
  // Chat operations
  loadChats: () => Promise<void>;
  createNewChat: () => Promise<ChatWithMessages>;
  selectChat: (chatId: number) => void;
  getCurrentChat: () => ChatWithMessages | null;
  getCurrentChatTitle: () => string;
  deleteCurrentChat: () => Promise<void>;
  updateChatTitle: (chatId: number, title: string) => Promise<void>;
  initializeStore: () => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

/**
 * Listen for chat title updates from the backend via WebSocket
 */
const listenForChatTitleUpdates = () => {
  return websocketService.subscribe('chat-title-updated', (message) => {
    const { chat_id, title } = message.payload;
    useChatStore.setState((state) => ({
      chats: state.chats.map((chat) => (chat.id === chat_id ? { ...chat, title } : chat)),
    }));
  });
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  chats: [],
  currentChatSessionId: null,
  isLoadingChats: false,

  // Actions
  loadChats: async () => {
    set({ isLoadingChats: true });
    try {
      const { data } = await getAllChats();
      if (data) {
        const initializedChats = data.map(initializeChat);
        set({
          chats: initializedChats,
          currentChatSessionId: initializedChats.length > 0 ? initializedChats[0].session_id : null,
          isLoadingChats: false,
        });
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      set({ isLoadingChats: false });
    }
  },

  createNewChat: async () => {
    try {
      const response = await createChat({
        body: { llm_provider: 'ollama' },
      });
      const initializedChat = initializeChat(response.data as ServerChatWithMessages);

      set((state) => ({
        chats: [initializedChat, ...state.chats],
        currentChatSessionId: initializedChat.session_id,
      }));

      return initializedChat;
    } catch (error) {
      console.error('Failed to create new chat:', error);
      throw error;
    }
  },

  selectChat: (chatId: number) => {
    const chat = get().chats.find((c) => c.id === chatId);
    if (chat) {
      set({ currentChatSessionId: chat.session_id });
    }
  },

  getCurrentChat: () => {
    const { currentChatSessionId, chats } = get();
    return chats.find((chat) => chat.session_id === currentChatSessionId) || null;
  },

  getCurrentChatTitle: () => {
    const currentChat = get().getCurrentChat();
    return currentChat?.title || DEFAULT_CHAT_TITLE;
  },

  deleteCurrentChat: async () => {
    const currentChat = get().getCurrentChat();
    if (!currentChat) return;

    try {
      await deleteChat({ path: { id: currentChat.id.toString() } });
      set((state) => {
        const newChats = state.chats.filter((chat) => chat.id !== currentChat.id);
        return {
          chats: newChats,
          currentChatSessionId: newChats.length > 0 ? newChats[0].session_id : null,
        };
      });
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  },

  updateChatTitle: async (chatId: number, title: string) => {
    try {
      await updateChat({
        path: { id: chatId.toString() },
        body: { title },
      });

      set((state) => ({
        chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
      }));
    } catch (error) {
      console.error('Failed to update chat title:', error);
    }
  },

  initializeStore: async () => {
    get().loadChats();

    try {
      await websocketService.connect();
      listenForChatTitleUpdates();
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }
  },
}));

// Initialize the chat store on mount
useChatStore.getState().initializeStore();
