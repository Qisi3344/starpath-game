export type GameState = {
  day: number;
  company: string;
  money: number;
  reputation: number;
  artistSigned: boolean;
  trained: boolean;
  jobAccepted: boolean;
  pr: string | null;
  settled: boolean;
  history: string[];
};
export type Action = {type:string; method?:string};
export const initialState: Readonly<GameState>;
export function start(company: string): GameState;
export function reduceGame(state: GameState, action: Action): GameState;
export function getFans(state: GameState): number;
