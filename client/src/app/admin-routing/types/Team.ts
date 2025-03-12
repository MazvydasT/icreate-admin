const _queryParamByTeamName = new Map([
  [`Absolute`, `t1`],
  [`Delta`, `t2`],
  [`Running Change`, `t3`],
  [`Initiate`, `t4`],
] as const);

export const teamNames = Array.from(_queryParamByTeamName.keys());
const queryParams = Array.from(_queryParamByTeamName.values());

export type TeamName = (typeof teamNames)[number];
type QueryParam = (typeof queryParams)[number];

export const queryParamByTeamName = _queryParamByTeamName as ReadonlyMap<
  TeamName,
  QueryParam
>;

export const teamNameByQueryParam = new Map(
  queryParamByTeamName.entries().map(([key, value]) => [value, key])
) as ReadonlyMap<QueryParam, TeamName>;
