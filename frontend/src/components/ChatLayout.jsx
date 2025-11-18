import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import { createApiClient } from "../lib/api";

export default function ChatLayout({
  currentUserId,
  currentAvatar,
  currentName,
  currentEmail
}) {
  const { getToken } = useAuth();
  const api = useMemo(() => createApiClient(getToken), [getToken]);

  const [conversations, setConversations] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState(null);

  const refreshConversations = useCallback(async () => {
    setError(null);
    setIsLoadingConversations(true);
    try {
      const list = await api.conversations.list();
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load conversations", err);
      setError("Unable to load conversations. Please try again.");
      setConversations([]); // Fixed: Ensure conversations is always an array
    } finally {
      setIsLoadingConversations(false);
    }
  }, [api]);

  const refreshDirectory = useCallback(async () => {
    try {
      const list = await api.users.list();
      // Fixed: Added Array.isArray check and default to empty array
      const userList = Array.isArray(list) ? list : [];
      setDirectory(userList.filter((user) => user.clerkUserId !== currentUserId));
    } catch (err) {
      console.error("Failed to load people", err);
      setDirectory([]); // Fixed: Set to empty array on error
    }
  }, [api, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    setIsBootstrapping(true);
    (async () => {
      try {
        // Fixed: Added try-catch for syncProfile
        try {
          await api.users.syncProfile({
            displayName: currentName,
            avatarUrl: currentAvatar,
            email: currentEmail
          });
        } catch (syncError) {
          console.warn("Profile sync failed, continuing anyway:", syncError);
        }

        if (!active) return;
        await Promise.all([refreshConversations(), refreshDirectory()]);
      } catch (err) {
        console.error("Bootstrap error", err);
        if (active) {
          setError("We couldn't prepare your chat workspace. Please refresh.");
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    api,
    currentAvatar,
    currentEmail,
    currentName,
    currentUserId,
    refreshConversations,
    refreshDirectory
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      return;
    }
    const match = conversations.find((conversation) => conversation.id === activeConversationId);
    if (match) {
      setActiveConversation(match);
    }
  }, [activeConversationId, conversations]);

  const handleSelectConversation = useCallback(async (conversationId) => {
    if (!conversationId) {
      setActiveConversationId(null);
      setActiveConversation(null);
      return;
    }
    setActiveConversationId(conversationId);
    const existing = conversations.find((conversation) => conversation.id === conversationId);
    if (!existing) {
      try {
        const detail = await api.conversations.getDetail(conversationId);
        setActiveConversation(detail);
        setConversations((prev) => {
          const already = prev.some((c) => c.id === detail.id);
          if (already) {
            return prev.map((item) => (item.id === detail.id ? detail : item));
          }
          return [detail, ...prev];
        });
      } catch (err) {
        console.error("Failed to load conversation detail", err);
      }
    }
  }, [api, conversations]);

  const handleStartConversation = useCallback(async (targetUserId) => {
    try {
      const conversation = await api.conversations.ensureConversation(targetUserId);
      setConversations((prev) => {
        const existing = prev.find((item) => item.id === conversation.id);
        if (existing) {
          return prev
            .map((item) => (item.id === conversation.id ? conversation : item))
            .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
        }
        return [conversation, ...prev];
      });
      setActiveConversationId(conversation.id);
      setActiveConversation(conversation);
    } catch (err) {
      console.error("Unable to start conversation", err);
      setError("Unable to start conversation. Please try again.");
    }
  }, [api]);

  const handleConversationSeen = useCallback((conversationId) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
  }, []);

  const handleMessageSent = useCallback((conversationId, message) => {
    setConversations((prev) => {
      const next = prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        return {
          ...conversation,
          lastMessage: {
            text: message.text,
            senderId: message.senderId,
            senderName: message.senderName,
            senderAvatar: message.senderAvatar,
            createdAt: message.createdAt
          },
          lastMessageAt: message.createdAt,
          unreadCount: 0
        };
      });

      next.sort(
        (a, b) =>
          new Date(b.lastMessageAt || b.createdAt).getTime() -
          new Date(a.lastMessageAt || a.createdAt).getTime()
      );
      return next;
    });
  }, []);

  return (
    <div className="flex h-full gap-6">
      <Sidebar
        currentUserId={currentUserId}
        currentDisplayName={currentName}
        currentAvatar={currentAvatar}
        conversations={conversations}
        directory={directory}
        isBootstrapping={isBootstrapping}
        isLoadingConversations={isLoadingConversations}
        onSelectConversation={handleSelectConversation}
        onStartConversation={handleStartConversation}
        onRefresh={refreshConversations}
        error={error}
        activeConversationId={activeConversationId}
      />

      <ChatWindow
        messagesApi={api.messages}
        conversation={activeConversation}
        conversationId={activeConversationId}
        currentUser={{
          id: currentUserId,
          name: currentName,
          avatar: currentAvatar
        }}
        onConversationSeen={handleConversationSeen}
        onMessageSent={handleMessageSent}
        isBootstrapping={isBootstrapping}
        getToken={getToken}
      />
    </div>
  );
}