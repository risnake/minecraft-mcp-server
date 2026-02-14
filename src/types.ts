export interface AppConfig {
  /** Human-readable server name used in logs */
  serverName: string;
  /** Runtime environment label */
  environment: "development" | "production" | "test";
}

export interface StartupContext {
  startedAt: Date;
  pid: number;
}
