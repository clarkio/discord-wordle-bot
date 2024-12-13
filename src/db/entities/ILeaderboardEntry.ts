export interface ILeaderboardEntry {
  discord_id: string;
  discord_name: string;
  wins: number;
  win_percent: number;
  losses: number;
  loss_percent: number;
  ties: number;
  tie_percent: number;
  failures: number;
  failure_percent: number;
  avg_attempts: number;
  total_games: number;
}
