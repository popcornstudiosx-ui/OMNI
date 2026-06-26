import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import type { Message } from "@shared/types";

interface ChatPanelProps {
  onSendMessage?: (content: string) => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  onVoiceTranscribed?: string;
  setTranscribedText?: (text: string | undefined) => void;
}

export function ChatPanel({ onSendMessage, isRecording, isProcessing, onVoiceTranscribed, setTranscribedText }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: initialMessages = [], refetch } = trpc.messages.list.useQuery();
  const chatMutation = trpc.omni.chat.useMutation();
  const { isSpeaking, speak } = useTextToSpeech();

  // Define handleSend first, before any useEffect that depends on it
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");

    setIsLoading(true);

    try {
      // Add user message to chat
      const newUserMsg: Message = {
        id: Date.now(),
        userId: 1,
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, newUserMsg]);

      // Get OMNI response
      const response = await chatMutation.mutateAsync({
        message: userMessage,
      });

      // Assistant message will be added via WebSocket, no optimistic update needed
      // Speak response is also handled by WebSocket listener

      onSendMessage?.(userMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, chatMutation, onSendMessage]);

  // Load initial messages and set up WebSocket for real-time updates
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }

    const ws = new WebSocket(`ws://${window.location.host}/api/ws`);

    ws.onopen = () => {
      console.log("[WebSocket] ChatPanel connected");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "chat_message") {
        console.log("[WebSocket] Received chat_message:", message.message);
        setMessages(prev => [...prev, message.message]);
        if (message.message.role === "assistant") {
          speak(message.message.content);
        }
      } else if (message.type === "task_notification") {
        // Optionally handle task notifications here if needed for chat context
        console.log("[WebSocket] Received task_notification:", message);
        refetch(); // Refetch messages to get potential OMNI responses related to tasks
      }
    };

    ws.onclose = () => {
      console.log("[WebSocket] ChatPanel disconnected");
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] ChatPanel error:", error);
    };

    return () => {
      ws.close();
    };
  }, [initialMessages, speak, refetch]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle voice transcription - set input and immediately send
  useEffect(() => {
    if (onVoiceTranscribed && !isLoading && !isProcessing) {
      setInput(onVoiceTranscribed);
      // Directly call handleSend after a short delay to allow UI to update
      const timer = setTimeout(() => {
        handleSend();
        setTranscribedText?.(undefined); // Clear transcribed text after sending
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [onVoiceTranscribed, isLoading, isProcessing, handleSend, setTranscribedText]);

  // Auto-send when voice input is ready (if not already sent by onVoiceTranscribed)
  useEffect(() => {
    if (input.trim() && !isLoading && !isProcessing && isRecording) {
      const timer = setTimeout(() => {
        handleSend();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [input, isLoading, isProcessing, isRecording, handleSend]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Start a conversation with OMNI...</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-100"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 p-4 bg-slate-900">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or use voice..."
            disabled={isLoading || isProcessing}
            className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-slate-400"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || isProcessing || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
