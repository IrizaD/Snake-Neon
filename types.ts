export interface Coordinate {
  x: number;
  y: number;
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface GameConfig {
  gridSize: number;
  speed: number;
}

export enum GameMode {
  MANUAL = 'MANUAL',
  AI_TRAINING = 'AI_TRAINING'
}

export interface QTable {
  [state: string]: {
    [action: string]: number
  }
}