import type { Player } from '../types/game';
import { cn } from '../lib/utils';
import { Trophy, Pencil, CheckCircle2 } from 'lucide-react';

interface PlayerListProps {
  players: Omit<Player, 'socketId'>[];
  drawerId: string | null;
  yourId: string;
}

export function PlayerList({ players, drawerId, yourId }: PlayerListProps) {
  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-2 w-full max-w-[250px]">
      <div className="flex items-center gap-2 px-1 mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Players</h3>
        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
          {players.length}
        </span>
      </div>

      <div className="space-y-2 relative">
        {sortedPlayers.map((player, idx) => {
          const isDrawer = player.id === drawerId;
          const isYou = player.id === yourId;

          return (
            <div
              key={player.id}
              className={cn(
                "group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
                player.hasGuessedCorrectly ? "bg-green-50 border-green-200" :
                isDrawer ? "bg-amber-50 border-amber-200 shadow-sm" :
                "bg-white border-slate-200 hover:border-slate-300",
                !player.isConnected && "opacity-50 grayscale"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {/* Rank Badge */}
                  <div className={cn(
                    "absolute -left-2 -top-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm z-10",
                    idx === 0 && players.length > 1 ? "bg-yellow-400 text-yellow-900 ring-2 ring-white" : "bg-slate-200 text-slate-600"
                  )}>
                    {idx === 0 && players.length > 1 ? <Trophy size={10} /> : idx + 1}
                  </div>
                  
                  {/* Avatar Placeholder */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0 shadow-sm">
                    {player.name[0].toUpperCase()}
                  </div>
                </div>

                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-800 truncate pr-2 flex items-center gap-1.5">
                    {player.name}
                    {isYou && <span className="text-[10px] font-bold tracking-widest bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 uppercase">You</span>}
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-slate-500">
                    {player.score.toLocaleString()} pts
                  </span>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex flex-col gap-1 items-end shrink-0 pl-2">
                {isDrawer && (
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-full animate-bounce shadow-sm">
                    <Pencil size={14} />
                  </div>
                )}
                {player.hasGuessedCorrectly && !isDrawer && (
                  <div className="p-1.5 bg-green-100 text-green-700 rounded-full shadow-sm">
                    <CheckCircle2 size={14} />
                  </div>
                )}
                {!player.isConnected && (
                  <span className="text-[10px] font-medium tracking-tight text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 italic">
                    Lost connection
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
