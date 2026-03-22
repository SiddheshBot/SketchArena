import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RoomSnapshot, DrawStroke, ScoreEntry } from '../types/game';
import { ClientEvent, ServerEvent } from '../types/events';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem: boolean;
  isCorrect?: boolean;
}

const SOCKET_URL = 'http://localhost:3000';

export function useGameEngine() {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Game State
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  
  // Transient state between rounds
  const [roundEndData, setRoundEndData] = useState<{ word: string; scores: ScoreEntry[] } | null>(null);
  const [gameOverData, setGameOverData] = useState<{ finalScores: ScoreEntry[]; winnerId: string | null } | null>(null);
  
  // Word picker choices
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  
  // Hint mapping
  const [closeGuessHint, setCloseGuessHint] = useState<boolean>(false);
  
  // Refs to avoid stale closures in listeners
  const roomRef = useRef<RoomSnapshot | null>(null);
  roomRef.current = room;

  useEffect(() => {
    // Note: in a real app, maybe only connect when they try to join.
    // However, connecting right away lets us gracefully handle socket IDs
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 10,
    });
    setSocket(newSocket);

    // ─── Listeners ───
    
    newSocket.on(ServerEvent.RoomState, (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setStrokes(snapshot.drawingStrokes);
      setRoundEndData(null);
      setGameOverData(null);
      setMessages([]); // clear chat on join
      addSystemMessage(`Joined room ${snapshot.id}`);
    });

    newSocket.on(ServerEvent.PlayerJoined, ({ player, reconnected }) => {
      setRoom(r => r ? { ...r, players: [...r.players, player] } : r);
      addSystemMessage(`${player.name} ${reconnected ? 'reconnected' : 'joined'}!`);
    });

    newSocket.on(ServerEvent.PlayerLeft, ({ playerId, temporary }) => {
      setRoom(r => {
        if (!r) return r;
        const p = r.players.find(x => x.id === playerId);
        if (p) addSystemMessage(`${p.name} ${temporary ? 'disconnected conditionally' : 'left'}.`);
        return {
          ...r,
          players: temporary 
            ? r.players // keeps them in the list if it's a temp disconnect
            : r.players.filter(x => x.id !== playerId)
        };
      });
    });

    newSocket.on(ServerEvent.PhaseChange, ({ phase, timerEndsAt, drawerId, wordLength, round }) => {
      setRoom(r => {
        if (!r) return r;
        return {
          ...r,
          state: { phase, timerEndsAt },
          currentDrawerId: drawerId ?? r.currentDrawerId,
          currentWordLength: wordLength ?? r.currentWordLength,
          currentRound: round ?? r.currentRound,
        };
      });
      setRoundEndData(null);
      setCloseGuessHint(false);
      
      if (phase === 'picking') {
        addSystemMessage('Drawer is picking a word...', true);
        setStrokes([]); // clear board
      }
      if (phase === 'drawing') {
        if (wordLength) addSystemMessage(`Word is ${wordLength} letters long!`, true);
      }
    });

    newSocket.on(ServerEvent.WordChoices, ({ words }) => {
      setWordChoices(words);
    });

    // Drawing
    newSocket.on(ServerEvent.DrawStroke, ({ stroke }) => {
      setStrokes(s => [...s, stroke]);
    });

    newSocket.on(ServerEvent.DrawClear, () => {
      setStrokes([]);
    });

    // Chat / Guessing
    newSocket.on(ServerEvent.GuessWrong, ({ playerName, text }) => {
      addMessage(playerName, text);
    });

    newSocket.on(ServerEvent.GuessCorrect, ({ playerName, score }) => {
      addSystemMessage(`${playerName} guessed the word! (+${score} pts)`, true, true);
      // Update score in player list
      setRoom(r => {
        if (!r) return r;
        const updated = r.players.map(p => p.name === playerName ? { ...p, score: p.score + score, hasGuessedCorrectly: true } : p);
        return { ...r, players: updated };
      });
    });

    newSocket.on(ServerEvent.GuessClose, () => {
      setCloseGuessHint(true);
      setTimeout(() => setCloseGuessHint(false), 3000);
      addSystemMessage(`You are almost there!`, true);
    });

    // Round / Game End
    newSocket.on(ServerEvent.RoundEnd, ({ word, scores }) => {
      setRoundEndData({ word, scores });
      addSystemMessage(`Round over! The word was: ${word}`);
      // Merge scores
      setRoom(r => {
        if (!r) return r;
        const playerScores = new Map<string, number>(scores.map((s: any) => [s.playerId, s.score]));
        return {
           ...r,
           state: { phase: 'roundEnd', timerEndsAt: 0 },
           players: r.players.map(p => ({ ...p, score: playerScores.get(p.id) ?? p.score, hasGuessedCorrectly: false }))
        };
      });
    });

    newSocket.on(ServerEvent.GameOver, ({ finalScores, winnerId }) => {
      setGameOverData({ finalScores, winnerId });
      setRoom(r => r ? { ...r, state: { phase: 'gameOver', timerEndsAt: 0 } } : r);
    });

    newSocket.on(ServerEvent.Error, ({ message }) => {
      addSystemMessage(`Error: ${message}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // ─── Actions ───

  const addMessage = (sender: string, text: string) => {
    setMessages(m => [...m, { id: Math.random().toString(), sender, text, isSystem: false }]);
  };

  const addSystemMessage = (text: string, _highlight = false, correct = false) => {
    setMessages(m => [...m, { id: Math.random().toString(), sender: 'System', text, isSystem: true, isCorrect: correct }]);
  };

  const createRoom = (playerName: string, rounds: number = 3) => {
    socket?.emit(ClientEvent.RoomCreate, {
      playerName,
      settings: { maxPlayers: 8, totalRounds: rounds, drawTimeSeconds: 60 }
    });
  };

  const joinRoom = (roomId: string, playerName: string) => {
    socket?.emit(ClientEvent.RoomJoin, { roomId, playerName });
  };

  const startGame = () => {
    socket?.emit(ClientEvent.GameStart);
  };

  const pickWord = (word: string) => {
    socket?.emit(ClientEvent.GamePickWord, { word });
    setWordChoices([]); 
  };

  const submitGuess = (text: string) => {
    if (!socket || !room) return;
    // Don't show local chat if drawer
    if (room.yourPlayerId !== room.currentDrawerId) {
       addMessage('You', text); 
    }
    socket.emit(ClientEvent.GuessSubmit, {
      eventId: Math.random().toString(),
      text
    });
  };

  const sendStroke = useCallback((stroke: Omit<DrawStroke, 't'> & { t: 0|1|2 }) => {
    if (!socket || !roomRef.current) return;
    socket.emit(ClientEvent.DrawStroke, {
      eventId: Math.random().toString(),
      stroke
    });
    // Optimistic local update
    setStrokes(s => [...s, stroke]);
  }, [socket]);

  const clearCanvas = useCallback(() => {
    if (!socket || !roomRef.current) return;
    socket.emit(ClientEvent.DrawClear, { eventId: Math.random().toString() });
    setStrokes([]);
  }, [socket]);

  return {
    socket,
    room,
    messages,
    strokes,
    wordChoices,
    roundEndData,
    gameOverData,
    closeGuessHint,
    actions: {
      createRoom,
      joinRoom,
      startGame,
      pickWord,
      submitGuess,
      sendStroke,
      clearCanvas
    }
  };
}
