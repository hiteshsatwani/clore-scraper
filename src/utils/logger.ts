type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (levels[currentLevel] <= levels.debug) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },

  info: (message: string, data?: unknown) => {
    if (levels[currentLevel] <= levels.info) {
      console.log(`[INFO] ${message}`, data || '');
    }
  },

  warn: (message: string, data?: unknown) => {
    if (levels[currentLevel] <= levels.warn) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },

  error: (message: string, error?: unknown) => {
    if (levels[currentLevel] <= levels.error) {
      console.error(`[ERROR] ${message}`, error || '');
    }
  },

  success: (message: string, data?: unknown) => {
    console.log(`✅ ${message}`, data || '');
  },

  fail: (message: string, data?: unknown) => {
    console.error(`❌ ${message}`, data || '');
  },
};
