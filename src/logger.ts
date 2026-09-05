import chalk from "chalk";

export function announce(message: string, _title?: string) {
  console.log(message);
}

/** Custom error class so callers can distinguish bgrun errors from unexpected ones */
export class BgrunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BgrunError";
  }
}

export function error(message: string | Error): never {
  const text =
    message instanceof Error
      ? message.stack || message.message
      : String(message);
  console.error(chalk.red(`error: ${text}`));
  throw new BgrunError(text);
}
