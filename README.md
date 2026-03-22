# 🎨 Sketch Arena

**A real-time multiplayer drawing and guessing game** – create a room, invite friends, draw the word before time runs out, and climb the leaderboard!

---

## 🚀 Tech Stack

**Backend**
- [Node.js](https://nodejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Socket.IO](https://socket.io/) — real-time bidirectional WebSocket communication
- [Express](https://expressjs.com/) — HTTP server and health-check endpoint

**Frontend**
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — lightning-fast dev server and build tool
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Shadcn UI](https://ui.shadcn.com/) — accessible component primitives
- [Lucide React](https://lucide.dev/) — icon library

---

## ✨ Features

| Feature | Details |
|---|---|
| 🏠 **Room System** | Create a private room or join with a 6-character code |
| 🎮 **Game Loop** | Server-authoritative phases: Waiting → Picking → Drawing → Guessing → Round End |
| 🖌️ **Drawing Canvas** | HTML5 canvas with color palette, brush size slider, and clear button |
| ⏱️ **Synchronized Timer** | Server-driven countdown using absolute timestamps — no client drift |
| 💬 **Live Chat & Guessing** | Real-time guess validation with close-guess hints |
| 🏆 **Scoring System** | Proximity-based points — faster correct guesses earn more |
| 🔄 **Stroke Replay** | Late-joining players see the full drawing replayed from history |
| 🔒 **Rate Limiting** | Token Bucket algorithm throttles guess, draw, and chat events per user |
| ⚙️ **Custom Rounds** | Room creator picks 3, 5, 7, or 10 rounds before starting |
| 📋 **Copy Room Code** | One-click copy button to share the room code instantly |
| 🔌 **Reconnection** | Players who disconnect temporarily stay in the room |

---

## 🏗️ Architecture Overview

```
┌───────────────────────────────┐
│         React Client          │
│  Canvas · Chat · PlayerList   │
└────────────┬──────────────────┘
             │  WebSocket (Socket.IO)
┌────────────▼──────────────────┐
│       Node.js Backend         │
│                               │
│  SocketHandlers               │
│   ├── RoomManager             │
│   ├── GameLoop (phases)       │
│   ├── Scoring                 │
│   ├── WordBank                │
│   ├── RateLimiter (Token Bucket)│
│   ├── EventQueue (per-room)   │
│   └── Timer (absolute ts)     │
└───────────────────────────────┘
```

---

## 📁 Project Structure

```
SketchArena/
├── src/                         # Backend source
│   ├── engine/
│   │   ├── GameLoop.ts          # Phase transitions & game orchestration
│   │   ├── RoomManager.ts       # Room creation, joining, player state
│   │   ├── Scoring.ts           # Proximity-based point calculation
│   │   └── WordBank.ts          # Word list and random selection
│   ├── middleware/
│   │   ├── RateLimiter.ts       # Token bucket rate limiter
│   │   └── Validator.ts         # Input sanitisation & type guards
│   ├── network/
│   │   ├── SocketHandlers.ts    # All Socket.IO event handlers
│   │   └── EventQueue.ts        # Serialized per-room event queue
│   ├── types/
│   │   ├── game.ts              # Core data models (Player, Room, GameState)
│   │   └── events.ts            # Socket event enums & payload interfaces
│   ├── utils/
│   │   ├── IdGenerator.ts       # Nanoid-based room & player IDs
│   │   ├── Logger.ts            # Structured logger with level filtering
│   │   └── Timer.ts             # Server-driven countdown timer
│   ├── config.ts                # Centralised configuration & constants
│   └── index.ts                 # Express + Socket.IO server entry point
│
└── frontend/                    # React client
    └── src/
        ├── components/
        │   ├── Canvas.tsx        # Drawing canvas with Pointer Events API
        │   ├── Chat.tsx          # Guess input & message feed
        │   └── PlayerList.tsx    # Scoreboard sidebar
        ├── hooks/
        │   └── useGameEngine.ts  # Socket.IO state management hook
        ├── types/                # Shared type definitions (mirrored)
        ├── lib/utils.ts          # Tailwind class merge utility
        └── App.tsx               # Root component, routing between views
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/SiddheshBot/SketchArena.git
cd SketchArena
```

### 2. Start the Backend

```bash
npm install
npm run build
npm start
```

The backend will be running at `http://localhost:3000`.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🎮 How to Play

1. **Enter a nickname** on the home screen.
2. **Create a Room** — choose your number of rounds (3 / 5 / 7 / 10), then share the room code with friends using the copy button.
3. **Friends join** by entering the same room code on the home screen.
4. The **Host** starts the game when everyone is ready.
5. Each round, the **Drawer** picks a word from 3 choices and draws it on the canvas.
6. **Guessers** type their answer in the chat — the faster you guess correctly, the more points you earn!
7. After all rounds, a **Game Over** screen shows the final leaderboard.

---

## ⚙️ Key Engineering Concepts Demonstrated

- **WebSocket event architecture** — typed events between client and server using shared enums
- **Token Bucket Rate Limiting** — prevents guess/draw/chat spam per socket
- **Serialized Event Queue** — prevents race conditions when multiple players guess simultaneously
- **Server-driven clock** — absolute `endsAt` timestamps eliminate client/server timer drift
- **Stroke history replay** — full drawing replayed from stored strokes for late joiners
- **Modular game engine** — clean separation between room management, game loop, scoring, and networking

---

## 📄 License

MIT
