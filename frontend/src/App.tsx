import { useState, useEffect } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { GameCanvas } from './components/Canvas';
import { Chat } from './components/Chat';
import { PlayerList } from './components/PlayerList';
import { Users, Clock, Hash, Zap, Trophy, Copy, Check } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const {
    room,
    messages,
    strokes,
    wordChoices,
    roundEndData,
    gameOverData,
    closeGuessHint,
    actions
  } = useGameEngine();

  const [nameInput, setNameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [rounds, setRounds] = useState(3);

  // Local timer count for smooth countdown
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!room?.state.timerEndsAt) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((room.state.timerEndsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.state.timerEndsAt]);

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-indigo-600 mb-2 flex items-center justify-center gap-2">
              <Zap className="fill-indigo-500" /> Sketch Arena
            </h1>
            <p className="text-slate-500">Draw, guess, and win!</p>
          </div>

          <div className="space-y-6">
            {/* Step 1: Nickname */}
            <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-inner">
              <label className="text-sm font-bold text-indigo-900 block mb-2 tracking-wide uppercase">
                1. Choose your nickname
              </label>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={16}
                className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-900 font-bold text-lg text-center"
                placeholder="E.g. Picasso"
              />
            </div>

            {/* Step 2: Actions (Faded if no name) */}
            <div className={cn("transition-all duration-300 space-y-4", !nameInput.trim() ? "opacity-40 grayscale pointer-events-none" : "opacity-100")}>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">2. Play</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <div className="flex flex-col gap-3 p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                <label className="text-sm font-bold text-slate-600 block flex items-center justify-between">
                  <span>Number of Rounds:</span>
                  <span className="bg-white px-3 py-1 rounded border shadow-sm text-indigo-700">{rounds}</span>
                </label>
                <div className="flex gap-2">
                  {[3, 5, 7, 10].map(r => (
                    <button
                      key={r}
                      onClick={() => setRounds(r)}
                      disabled={!nameInput.trim()}
                      className={cn(
                        "flex-1 py-2 rounded-lg font-bold border transition-all",
                        rounds === r ? "bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105" : "bg-white text-slate-600 hover:bg-indigo-50 border-slate-200"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  disabled={!nameInput.trim()}
                  onClick={() => actions.createRoom(nameInput, rounds)}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none text-white font-bold py-4 px-4 rounded-xl transition-all shadow-md shadow-indigo-200 text-lg hover:-translate-y-0.5"
                >
                  Create a New Room
                </button>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold tracking-widest">OR</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="flex gap-2">
                <input
                  value={roomIdInput}
                  onChange={e => setRoomIdInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-[2] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-widest font-mono text-center text-slate-700 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans font-bold text-lg"
                  placeholder="Paste Room Code"
                />
                <button
                  disabled={!roomIdInput.trim() || !nameInput.trim()}
                  onClick={() => actions.joinRoom(roomIdInput, nameInput)}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 justify-center flex items-center disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm text-lg"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isHost = room.yourPlayerId === room.hostId;
  const isDrawer = room.yourPlayerId === room.currentDrawerId;

  // Lobby view before game starts
  if (room.state.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-3xl w-full border border-slate-100">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Waiting Room</h1>
              <div className="flex items-center gap-2 text-slate-500 font-medium tracking-wide">
                <span>ROOM CODE:</span>
                <div className="flex items-center gap-1 bg-indigo-100 text-indigo-800 font-mono font-bold px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                  <span className="tracking-widest text-lg select-all">{room.id}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(room.id);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="ml-2 p-1.5 hover:bg-indigo-200 rounded-md transition-colors"
                    title="Copy Room Code"
                  >
                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-indigo-600" />}
                  </button>
                </div>
              </div>
            </div>
            {isHost && (
              <button
                onClick={actions.startGame}
                disabled={room.players.length < 2}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-sm text-lg transition-transform active:scale-95"
              >
                Start Game
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {room.players.map(p => (
              <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 mb-3 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                  {p.name[0].toUpperCase()}
                </div>
                <span className="font-semibold text-slate-700 text-center truncate w-full">{p.name}</span>
                {p.id === room.hostId && (
                  <span className="absolute top-2 right-2 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded shadow-sm">
                    HOST
                  </span>
                )}
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 8 - room.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center opacity-50 bg-slate-50/50">
                <span className="text-slate-400 font-medium">Waiting...</span>
              </div>
            ))}
          </div>
          {room.players.length < 2 && (
            <div className="mt-6 text-center text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium">
              Waiting for at least 2 players to start...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-slate-600 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Clock size={18} className={timeLeft <= 10 && room.state.phase === 'drawing' ? 'text-red-500 animate-pulse' : 'text-slate-400'} />
              <span className={cn("text-lg font-mono", timeLeft <= 10 && room.state.phase === 'drawing' ? 'text-red-500' : '')}>
                {timeLeft}s
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Hash size={18} className="text-slate-400" />
              <span>Round {room.currentRound} of {room.settings.totalRounds}</span>
            </div>
          </div>

          {/* Secret Word Display */}
          <div className="flex items-center absolute left-1/2 -translate-x-1/2">
            {room.state.phase === 'drawing' && room.currentWordLength && !isDrawer ? (
                <div className="flex gap-2">
                  {Array.from({ length: room.currentWordLength }).map((_, i) => (
                    <span key={i} className="inline-block border-b-4 border-slate-400 w-6 h-8 -mb-2 shadow-sm font-mono text-xl text-center text-slate-700 bg-slate-100 rounded-t-sm" />
                  ))}
                </div>
            ) : room.state.phase === 'drawing' && isDrawer || room.state.phase === 'roundEnd' ? (
                <span className="text-2xl font-extrabold tracking-[0.2em] uppercase text-slate-800 bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 shadow-sm">
                  {roundEndData?.word || "YOUR WORD"}
                </span>
            ) : room.state.phase === 'picking' && isDrawer ? (
                <span className="text-xl font-bold bg-amber-50 text-amber-600 px-4 py-2 rounded-lg border border-amber-200 animate-pulse shadow-sm">
                  Choose a word!
                </span>
            ) : room.state.phase === 'picking' && !isDrawer ? (
                 <span className="text-xl font-bold text-slate-600 px-4 py-2 bg-slate-50 rounded-lg">
                  Drawer is picking a word...
                </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-mono text-sm tracking-widest font-bold">
            <Users size={16} /> ROOM {room.id}
          </div>
        </div>
      </header>

      {/* OVERLAYS */}
      {closeGuessHint && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white font-bold px-6 py-3 rounded-full shadow-lg shadow-green-500/20 animate-bounce">
          You're incredibly close!
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 flex gap-4 h-[calc(100vh-64px)] overflow-hidden">
        {/* LEFT COLUMN: Canvas + Interaction */}
        <div className="flex-1 flex flex-col gap-4 relative min-w-0">
          
          <div className="flex-1 relative">
            {room.state.phase === 'picking' && isDrawer ? (
              <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 shadow-xl">
                <h2 className="text-3xl font-extrabold text-slate-800 mb-8">Choose aword to draw</h2>
                <div className="flex gap-4">
                  {wordChoices.map(word => (
                    <button
                      key={word}
                      onClick={() => actions.pickWord(word)}
                      className="bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xl px-8 py-6 rounded-xl border border-indigo-200 shadow-sm transition-all hover:scale-105"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {room.state.phase === 'roundEnd' && roundEndData ? (
              <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 shadow-xl">
                <h2 className="text-4xl font-extrabold text-slate-800 mb-4">Round Over!</h2>
                <p className="text-2xl text-slate-600 mb-8 font-medium">The word was: <span className="font-extrabold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-200">{roundEndData.word.toUpperCase()}</span></p>
                <div className="grid gap-2 w-full max-w-md">
                  {roundEndData.scores.sort((a,b)=>b.roundScore - a.roundScore).map((s, i) => (
                    <div key={s.playerId} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border font-bold">
                      <span className="text-slate-700">{i+1}. {s.name}</span>
                      <span className={s.roundScore > 0 ? "text-green-600 drop-shadow-sm" : "text-slate-400"}>
                        +{s.roundScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            
            {room.state.phase === 'gameOver' && gameOverData ? (
              <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 shadow-xl">
                <Trophy size={64} className="text-yellow-400 mb-4 drop-shadow-lg" />
                <h2 className="text-5xl font-extrabold text-slate-800 mb-8">Game Over!</h2>
                
                <div className="grid gap-3 w-full max-w-md bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                  {gameOverData.finalScores.map((s, i) => (
                    <div key={s.playerId} className={cn("flex justify-between items-center bg-white p-4 rounded-xl border font-bold shadow-sm transition-transform", i===0 && "border-yellow-300 bg-yellow-50 text-yellow-900 scale-105")}>
                      <span className="flex items-center gap-2">
                        {i === 0 && <Trophy size={18} className="text-yellow-500" />}
                        {i+1}. {s.name}
                      </span>
                      <span>{s.score} pts</span>
                    </div>
                  ))}
                </div>

                <p className="text-slate-500 font-medium mt-6 bg-slate-100 px-4 py-2 rounded-lg">Returning to lobby in a few seconds...</p>
              </div>
            ) : null}

            <GameCanvas
              strokes={strokes}
              onDraw={actions.sendStroke}
              onClear={actions.clearCanvas}
              isDrawer={isDrawer}
              className="w-full h-full shadow-md"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Players + Chat) */}
        <div className="w-[320px] shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 h-fit max-h-[40%] overflow-y-auto w-full">
            <PlayerList
              players={room.players}
              drawerId={room.currentDrawerId}
              yourId={room.yourPlayerId}
            />
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden w-full">
            <Chat
              messages={messages}
              onGuess={actions.submitGuess}
              canGuess={!isDrawer && room.state.phase === 'drawing'}
              className="flex-1 h-auto"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
