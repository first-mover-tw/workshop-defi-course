// Simple logger for Bun
const DEBUG = process.env.DEBUG === "true" || process.env.DEBUG === "1";

export const logger = {
  info: (...args: any[]) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`${timestamp} INFO`, ...args);
  },

  warn: (...args: any[]) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.warn(`${timestamp} WARN`, ...args);
  },

  error: (...args: any[]) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.error(`${timestamp} ERROR`, ...args);

    // Print stack trace for Error objects
    args.forEach((arg) => {
      if (arg instanceof Error && arg.stack) {
        console.error(arg.stack);
      }
    });
  },

  debug: (...args: any[]) => {
    if (!DEBUG) return; // Only log debug messages if DEBUG is enabled
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.debug(`${timestamp} DEBUG`, ...args);
  },
};
