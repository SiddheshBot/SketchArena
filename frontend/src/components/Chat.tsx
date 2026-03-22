import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem: boolean;
  isCorrect?: boolean;
}

interface ChatProps {
  messages: ChatMessage[];
  onGuess: (text: string) => void;
  canGuess: boolean;
  className?: string;
}

export function Chat({ messages, onGuess, canGuess, className }: ChatProps) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canGuess) return;
    onGuess(input.trim());
    setInput('');
  };

  return (
    <div className={cn("flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-[600px]", className)}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "text-sm p-2.5 rounded-lg break-words max-w-[90%]",
              msg.isSystem ? "bg-slate-200/50 text-slate-500 text-xs text-center mx-auto italic" : 
              msg.isCorrect ? "bg-green-100 text-green-800 font-medium ml-auto" : 
              "bg-white border shadow-sm",
              msg.sender === 'You' ? "ml-auto bg-indigo-50 border-indigo-100" : ""
            )}
          >
            {!msg.isSystem && (
              <span className="font-semibold text-slate-700 mr-2 text-xs opacity-70">
                {msg.sender}:
              </span>
            )}
            <span>{msg.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form 
        onSubmit={handleSubmit}
        className="p-3 bg-white border-t flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canGuess ? "Type your guess..." : "You are drawing now..."}
          disabled={!canGuess}
          className="flex-1 bg-slate-100 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-indigo-500 disabled:opacity-50"
          maxLength={50}
        />
        <button
          type="submit"
          disabled={!input.trim() || !canGuess}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg p-2.5 transition-colors flex items-center justify-center"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
