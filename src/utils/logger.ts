import chalk from 'chalk';

export interface Logger {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

export function createLogger(): Logger {
  return {
    info(message: string): void {
      // eslint-disable-next-line no-console
      console.log(chalk.blue(message));
    },
    success(message: string): void {
      // eslint-disable-next-line no-console
      console.log(chalk.green(message));
    },
    error(message: string): void {
      // eslint-disable-next-line no-console
      console.error(chalk.red(message));
    },
    warn(message: string): void {
      // eslint-disable-next-line no-console
      console.warn(chalk.yellow(message));
    },
  };
}
