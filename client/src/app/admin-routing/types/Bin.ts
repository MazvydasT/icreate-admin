import { TeamName } from './Team';

export type Bin = {
  name: string;
  workValue: number;
  isSelected: boolean;
  teams: Set<TeamName>;
  indices: Set<number>;
};
