// ─── Client → Server Events ───
export enum ClientEvent {
  RoomCreate   = 'room:create',
  RoomJoin     = 'room:join',
  RoomLeave    = 'room:leave',
  GameStart    = 'game:start',
  GamePickWord = 'game:pickWord',
  DrawStroke   = 'draw:stroke',
  DrawClear    = 'draw:clear',
  GuessSubmit  = 'guess:submit',
  Reconnect    = 'player:reconnect',
}

// ─── Server → Client Events ───
export enum ServerEvent {
  RoomState       = 'room:state',
  PlayerJoined    = 'room:playerJoined',
  PlayerLeft      = 'room:playerLeft',
  PhaseChange     = 'game:phaseChange',
  WordChoices     = 'game:wordChoices',
  DrawStroke      = 'draw:stroke',
  DrawClear       = 'draw:clear',
  GuessCorrect    = 'guess:correct',
  GuessWrong      = 'guess:wrong',
  GuessClose      = 'guess:close',
  RoundEnd        = 'round:end',
  GameOver        = 'game:over',
  Error           = 'error',
}

// ─── Payload Types ───

export interface CreateRoomPayload {
  playerName: string;
  settings: {
    maxPlayers: number;
    totalRounds: number;
    drawTimeSeconds: number;
  };
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface PickWordPayload {
  word: string;
}

export interface DrawStrokePayload {
  eventId: string;
  stroke: {
    t: 0 | 1 | 2;
    x: number;
    y: number;
    c: string;
    w: number;
  };
}

export interface DrawClearPayload {
  eventId: string;
}

export interface GuessPayload {
  eventId: string;
  text: string;
}

export interface ReconnectPayload {
  playerId: string;
  roomId: string;
}
