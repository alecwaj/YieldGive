"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";
import { CharityCard } from "./CharityCard";

interface Recommendation {
  name: string;
  wallet: string;
  category: string;
  reason: string;
  suggested_pct: number;
  final_pct?: number;
}

interface CharityBotProps {
  onConfigSaved: (recs: Recommendation[]) => void;
}

export function CharityBot({ onConfigSaved }: CharityBotProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      initialMessages: [
        {
          id: "greeting",
          role: "assistant",
          content:
            "Hi! I'm here to help you put your yield to work for causes you care about. To get started — what issues or problems in the world matter most to you right now?",
        },
      ],
      onFinish: (message) => {
        const jsonMatch = message.content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.recommendations) {
              setRecommendations(parsed.recommendations);
              const initialWeights: Record<string, number> = {};
              parsed.recommendations.forEach((r: Recommendation) => {
                initialWeights[r.wallet] = r.suggested_pct;
              });
              setWeights(initialWeights);
            }
          } catch {}
        }
      },
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightsValid = totalWeight === 100;

  function handleSave() {
    onConfigSaved(
      recommendations.map((r) => ({ ...r, final_pct: weights[r.wallet] }))
    );
  }

  function displayContent(content: string) {
    return content.replace(/```json[\s\S]*?```/, "[Recommendations ready ↗]");
  }

  return (
    <div className="flex gap-6 h-full max-h-[calc(100vh-120px)]">
      {/* Chat panel */}
      <div className="flex flex-col flex-1 max-w-xl bg-white rounded-2xl border">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-sm text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {displayContent(m.content)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-400 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {recommendations.length === 0 && (
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 p-4 border-t"
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your response..."
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>

      {/* Recommendations panel */}
      {recommendations.length > 0 && (
        <div className="w-80 flex flex-col gap-4 overflow-y-auto">
          <h2 className="font-semibold text-gray-900">Your personalized match</h2>
          {recommendations.map((rec) => (
            <CharityCard
              key={rec.wallet}
              name={rec.name}
              category={rec.category}
              wallet={rec.wallet}
              matchReason={rec.reason}
              editable
              weight={weights[rec.wallet]}
              onWeightChange={(pct) =>
                setWeights((w) => ({ ...w, [rec.wallet]: pct }))
              }
            />
          ))}

          <div
            className={`text-sm font-medium ${weightsValid ? "text-green-600" : "text-red-500"}`}
          >
            Total: {totalWeight}%{" "}
            {weightsValid ? "✓" : "(must equal 100%)"}
          </div>

          <button
            onClick={handleSave}
            disabled={!weightsValid}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-medium disabled:opacity-50 hover:bg-green-700"
          >
            Save & Continue to Deposit →
          </button>
        </div>
      )}
    </div>
  );
}
