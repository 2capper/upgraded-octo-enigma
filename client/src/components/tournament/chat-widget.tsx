import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  tournamentId: string;
  tournamentName: string;
}

export function ChatWidget({ tournamentId, tournamentName }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["/api/tournaments", tournamentId, "chat", "suggestions"],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/chat/suggestions`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", `/api/tournaments/${tournamentId}/chat`, {
        message,
        conversationHistory: messages,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble right now. Please try again in a moment.",
        },
      ]);
    },
  });

  const handleSend = () => {
    const message = inputValue.trim();
    if (!message || chatMutation.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInputValue("");
    chatMutation.mutate(message);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessages((prev) => [...prev, { role: "user", content: suggestion }]);
    chatMutation.mutate(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("chat") === "open") {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg bg-[var(--forest-green)] hover:bg-[var(--forest-green)]/90 z-50"
        data-testid="button-open-chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 w-[360px] h-[500px] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col z-50 border"
      data-testid="chat-widget-container"
    >
      <div className="flex items-center justify-between p-3 border-b bg-[var(--forest-green)] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-semibold text-sm">Tournament Assistant</h3>
            <p className="text-xs opacity-80 truncate max-w-[200px]">{tournamentName}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 text-white hover:bg-white/20"
          data-testid="button-close-chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-full bg-[var(--forest-green)] flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[85%]">
                <p className="text-sm">
                  Hi! I'm your tournament assistant. I can help you find:
                </p>
                <ul className="text-sm mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Game schedules & times</li>
                  <li>• Current standings</li>
                  <li>• Diamond locations</li>
                  <li>• Team information</li>
                </ul>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Quick questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-2"
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={chatMutation.isPending}
                      data-testid={`button-suggestion-${index}`}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-2",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                    message.role === "assistant"
                      ? "bg-[var(--forest-green)]"
                      : "bg-blue-500"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Bot className="h-4 w-4 text-white" />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-lg p-3 max-w-[85%] text-sm",
                    message.role === "assistant"
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "bg-blue-500 text-white"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 rounded-full bg-[var(--forest-green)] flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about schedules, standings..."
            className="flex-1"
            maxLength={500}
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || chatMutation.isPending}
            size="icon"
            className="bg-[var(--forest-green)] hover:bg-[var(--forest-green)]/90"
            data-testid="button-send-chat"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          AI-powered assistant • Read-only access
        </p>
      </div>
    </div>
  );
}
