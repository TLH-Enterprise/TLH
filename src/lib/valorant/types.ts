export type Mode = "competitive" | "premier" | "custom";
export type Side = "Red" | "Blue";

export interface RosterPlayer {
  name: string;
  tag: string;
  puuid: string;
}

export interface Roster {
  region: "na";
  premierTeam: { name: string; tag: string };
  players: RosterPlayer[];
}

export interface PlayerMatch {
  matchId: string;
  puuid: string;
  mode: Mode;
  startedAt: string;
  map: string;
  season: string;
  agent: string;
  side: Side;
  roundsWon: number;
  roundsLost: number;
  /** null = empate */
  won: boolean | null;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  damageMade: number;
  damageReceived: number;
  score: number;
  tier: number;
}

export interface LineupEntry {
  puuid: string;
  riotId: string;
  agent: string;
  inRoster: boolean;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  damage: number;
  score: number;
}

export interface TeamRound {
  won: boolean;
  role: "Attack" | "Defense";
}

export interface TeamMatch {
  matchId: string;
  kind: "premier" | "custom";
  startedAt: string;
  map: string;
  season: string;
  side: Side;
  roundsWon: number;
  roundsLost: number;
  won: boolean | null;
  opponentName: string | null;
  opponentPlayers: string[];
  lineup: LineupEntry[];
  rounds: TeamRound[];
}

export interface PremierStatus {
  points: number;
  division: number;
  place: number;
  conference: string;
  wins: number;
  losses: number;
}

export interface RankSnapshot {
  tier: number;
  tierName: string;
  rr: number;
  elo: number;
}

export interface Snapshot {
  /** YYYY-MM-DD */
  date: string;
  players: Record<string, RankSnapshot>;
  premier: PremierStatus | null;
}

export interface MatchLabel {
  rival?: string;
  type?: "scrim" | "torneo";
  include?: boolean;
}

export type Labels = Record<string, MatchLabel>;

export interface Meta {
  updatedAt: string | null;
  nonTeamMatchIds: string[];
}

export interface Dataset {
  meta: Meta;
  roster: Roster;
  playerMatches: PlayerMatch[];
  teamMatches: TeamMatch[];
  snapshots: Snapshot[];
  labels: Labels;
}
