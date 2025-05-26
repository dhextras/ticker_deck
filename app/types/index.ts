export interface TradingMessage {
  id: string;
  sender: string;
  name: string;
  title?: string;
  content?: string;
  tickers: string[];
  timestamp?: string;
}

export interface TradingLog {
  timestamp: string;
  userId: string;
  action: "buy" | "sell";
  ticker: string;
  shares: number;
  quantity: number;
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface TestCase {
  id: string;
  level: "easy" | "medium" | "hard";
  messages: TradingMessage[];
  expectedActions: ExpectedAction[];
}

export interface ExpectedAction {
  ticker: string;
  action: "buy" | "sell" | "ignore";
  shares: number;
  quantity: number;
  timing?: number;
}

export interface TradingAction {
  action: "buy" | "sell";
  ticker: string;
  shares: number;
  quantity: number;
  timestamp: string;
  messageId?: string;
  timingMs?: number;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
}

export interface User {
  id: string;
  username: string;
}

export interface TradingPopupData {
  message: TradingMessage;
  isVisible: boolean;
}
