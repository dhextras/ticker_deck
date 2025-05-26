import { promises as fs } from "fs";
import { join } from "path";
import type { TradingLog } from "../app/types";

const LOG_FILE = join(process.cwd(), "data", "trading-history.json");

export async function ensureDataDirectory(): Promise<void> {
  const dataDir = join(process.cwd(), "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

export async function loadTradingLogs(): Promise<TradingLog[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function saveTradingLogs(logs: TradingLog[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
}

export async function logTradingAction(action: TradingLog): Promise<boolean> {
  try {
    const logs = await loadTradingLogs();
    logs.push(action);
    await saveTradingLogs(logs);
    return true;
  } catch (error) {
    console.error("Error logging trading action:", error);
    return false;
  }
}

export async function getTradingLogs(
  userId?: string,
  startDate?: string,
  endDate?: string,
  ticker?: string,
  action?: "buy" | "sell",
): Promise<TradingLog[]> {
  try {
    let logs = await loadTradingLogs();

    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    if (startDate) {
      logs = logs.filter((log) => log.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter((log) => log.timestamp <= endDate);
    }

    if (ticker) {
      logs = logs.filter(
        (log) => log.ticker.toLowerCase() === ticker.toLowerCase(),
      );
    }

    if (action) {
      logs = logs.filter((log) => log.action === action);
    }

    return logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    console.error("Error getting trading logs:", error);
    return [];
  }
}
