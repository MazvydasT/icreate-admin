export type Config = {
  connectionId: string;
  tables: [string, ...string[]];
};

export type ConfigOrConfigs = Config | [Config, ...Config[]];
