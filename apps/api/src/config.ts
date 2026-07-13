export interface AppConfig {
  port: number;
}

export function getConfig(): AppConfig {
  const port = parseInt(process.env.PORT ?? '', 10);
  return {
    port: Number.isFinite(port) ? port : 3000,
  };
}
