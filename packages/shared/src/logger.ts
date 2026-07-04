import pino from 'pino';
import path from 'path';

let logger: pino.Logger;

export function createLogger(logDir: string, level = 'info'): pino.Logger {
  const logPath = path.join(logDir, 'workmemory.log');

  logger = pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    },
    pino.transport({
      targets: [
        {
          target: 'pino/file',
          options: { destination: logPath, mkdir: true },
          level,
        },
        {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
          level,
        },
      ],
    })
  );

  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    logger = pino({ level: 'info' });
  }
  return logger;
}
