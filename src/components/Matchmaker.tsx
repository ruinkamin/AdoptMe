import { useState } from "react";
import { Pet } from "../types/pet";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Search, Loader2, Send } from "lucide-react";
import { apiCall } from "../utils/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MatchmakerProps {
  pets: Pet[];
  onMatch: (pet: Pet) => void;
  onAiFilter: (petIds: string[]) => void;
}

export function Matchmaker({ pets, onMatch, onAiFilter }: MatchmakerProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    try {
      setError("");
      setLoading(true);

      // Додаємо повідомлення користувача до списку
      const userMessage: Message = {
        role: "user",
        content: input.trim(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");

      // Відправляємо всі повідомлення (включаючи нове) на API
      const response = await apiCall("/ai/chat", "POST", {
        messages: updatedMessages,
      });

      // Додаємо відповідь асистента
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message || response.reply || response.content || "",
        },
      ]);
      // Фільтруємо каталог, якщо ШІ повернув ID тварин
      if (response.suggested_pet_ids) {
        onAiFilter(response.suggested_pet_ids.map(String));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка при запиті до ШІ");
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setError("");
    onAiFilter([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border-amber-100">
        <CardHeader>
          <CardTitle className="text-amber-900 flex items-center gap-2">
            <Search className="w-5 h-5" />
            ШІ-Чат: Підбір улюбленця
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Діалог */}
          <div className="bg-amber-50 rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto space-y-3 border border-amber-100">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Почніть розмову — розповідайте про себе, свій образ життя, уподобання!
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${msg.role === "user"
                      ? "bg-amber-600 text-white rounded-br-none"
                      : "bg-white border border-amber-200 text-slate-800 rounded-bl-none"
                      }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-amber-200 px-3 py-2 rounded-lg text-sm text-slate-800 rounded-bl-none">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  ШІ розмірковує...
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Поле введення */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Розповідайте про себе (помешкання, робочий час, бюджет, діти, інші тварини)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="min-h-20 border-amber-200 resize-none"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="bg-amber-600 hover:bg-amber-700 p-2 h-auto flex items-center justify-center"
                title="Відправити (Shift+Enter)"
              >
                <Send className="w-4 h-4" />
              </Button>
              {messages.length > 0 && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="text-amber-800 p-2 h-auto text-xs"
                >
                  Скинути
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
