import { TeamName } from './Team';

export type Bin = {
  name: string;
  partCount: number;
  isSelected: boolean;
  teams: Set<TeamName>;
  indices: Set<number>;
};
