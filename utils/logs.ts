import axios from 'axios';
import fs from 'fs';

export const logError = (error: any, attempt: number, errorLogPath: string) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    attempt,
    error: error instanceof Error ? error.message : String(error),
    details: axios.isAxiosError(error)
      ? {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        }
      : error,
  };

  let logs = [];
  try {
    if (fs.existsSync(errorLogPath)) {
      logs = JSON.parse(fs.readFileSync(errorLogPath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading log file:', e);
  }

  logs.push(errorLog);
  fs.writeFileSync(errorLogPath, JSON.stringify(logs, null, 2));
};
