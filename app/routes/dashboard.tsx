import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { useCallback, useEffect, useState } from "react";
import type { TradingAction, TradingLog, TradingMessage } from "~/types";
import { requireUserId } from "~/utils/auth.server";
import { createInitialHotkeyState, type HotkeyState } from "~/utils/hotkeys";
import {
  initSocket,
  offMessage,
  offTradingResponse,
  onMessage,
  onTradingResponse,
  sendTradingAction,
} from "~/utils/websocket.client";

import NotificationPopup from "~/components/NotificationPopup";
import TradingPopup from "~/components/TradingPopup";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  function getTokenFromCookie(
    cookieString: string | null | undefined,
    tokenName: string,
  ): string {
    if (!cookieString) return "";

    const cookies: Record<string, string> = cookieString.split("; ").reduce(
      (acc, cookie) => {
        const [name, ...rest] = cookie.split("=");
        acc[name] = rest.join("=");
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies[tokenName] || "";
  }

  // Read trading logs from file
  const logsPath = join(process.cwd(), "data", "trading-history.json");
  let historicalLogs: TradingLog[] = [];
  if (existsSync(logsPath)) {
    try {
      const fileContent = readFileSync(logsPath, "utf-8");
      historicalLogs = JSON.parse(fileContent);
      historicalLogs = historicalLogs
        .filter((log) => log.userId === userId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
    } catch (error) {
      console.error("Error reading trading logs:", error);
    }
  }

  const cookieHeader = request.headers.get("cookie");
  const token = getTokenFromCookie(cookieHeader, "ticker_deck_session");
  return json({ userId, token, historicalLogs });
}

export default function Dashboard() {
  const { userId, token, historicalLogs } = useLoaderData<typeof loader>();

  const [messageQueue, setMessageQueue] = useState<TradingMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<TradingMessage | null>(
    null,
  );
  const [tradingHistory, setTradingHistory] = useState<TradingLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationAllowed, setNotificationAllowed] = useState(false);
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [hotkeyState, setHotkeyState] = useState<HotkeyState>(
    createInitialHotkeyState(),
  );
  const [selectedTicker, setSelectedTicker] = useState(1);
  const [shareAmount, setShareAmount] = useState(5000);

  const allTradingHistory = [...tradingHistory, ...historicalLogs];

  const checkPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const isGranted = Notification.permission === "granted";
      setNotificationAllowed(isGranted);
    }
  };

  useEffect(() => {
    if (notificationAllowed && isConnected) {
      new Notification("WebSocket Connected", {
        body: "You are now connected to the WebSocket server",
      });
    }
  }, [notificationAllowed, isConnected]);

  useEffect(() => {
    checkPermission();

    if (token) {
      const socket = initSocket(token);

      socket.on("connect", async () => {
        setIsConnected(true);
        checkPermission();
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  const handleMessage = useCallback((message: TradingMessage) => {
    console.log("Received message:", message);

    const messageWithId = {
      ...message,
      id:
        message.id ||
        `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: message.timestamp || new Date().toISOString(),
    };

    setMessageQueue((prev) => [...prev, messageWithId]);
  }, []);

  useEffect(() => {
    if (messageQueue.length > 0 && !currentMessage) {
      const nextMessage = messageQueue[0];
      if (notificationAllowed) {
        new Notification("New Trade alert", {
          body: `${nextMessage.sender} - ${nextMessage.name}`,
        });
      }

      setCurrentMessage(nextMessage);
      setMessageQueue((prev) => prev.slice(1));
      setSelectedTicker(1);
    }
  }, [messageQueue, currentMessage]);

  const handleTradingResponse = useCallback(
    (response: any) => {
      console.log("Trading response:", response);

      const notificationData = {
        id: Date.now().toString(),
        title: response.success ? "Trade Executed" : "Trade Failed",
        message:
          response.message ||
          `${response.action} ${response.quantity}x ${response.shares} shares of ${response.ticker}`,
        timestamp: new Date().toISOString(),
        type: response.success ? ("success" as const) : ("error" as const),
      };

      setNotification(notificationData);

      if (response.success) {
        const tradeLog: TradingLog = {
          timestamp: response.timestamp || new Date().toISOString(),
          userId: userId,
          action: response.action,
          ticker: response.ticker,
          shares: response.shares,
          quantity: response.quantity,
          success: true,
          messageId: response.messageId,
        };

        setTradingHistory((prev) => [tradeLog, ...prev]);
      }
    },
    [userId],
  );

  useEffect(() => {
    onMessage(handleMessage);
    onTradingResponse(handleTradingResponse);

    return () => {
      offMessage(handleMessage);
      offTradingResponse(handleTradingResponse);
    };
  }, [handleMessage, handleTradingResponse]);

  const handleTrade = useCallback(
    (action: "buy" | "sell", ticker: string, shares: number) => {
      if (!currentMessage) return;

      const tradingAction: TradingAction = {
        action,
        ticker,
        shares,
        quantity: 1,
        timestamp: new Date().toISOString(),
        messageId: currentMessage.id,
      };

      sendTradingAction(tradingAction);
    },
    [currentMessage],
  );

  const handleClosePopup = useCallback(() => {
    setCurrentMessage(null);
  }, []);

  const handleTickerChange = useCallback((ticker: number) => {
    setSelectedTicker(ticker);
  }, []);

  const handleShareChange = useCallback((shares: number) => {
    setShareAmount(shares);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TradingPopup
        message={currentMessage}
        onClose={handleClosePopup}
        onTrade={handleTrade}
        onTickerChange={handleTickerChange}
        onShareChange={handleShareChange}
        selectedTicker={selectedTicker}
        shareAmount={shareAmount}
        hotkeyState={hotkeyState}
        onStateChange={setHotkeyState}
      />

      <NotificationPopup
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <header className="flex items-center justify-between bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Trading Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
            {messageQueue.length > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-1 text-xs">
                {messageQueue.length} pending
              </span>
            )}
          </div>
          <nav className="space-x-4">
            <Link to="/practice" className="text-blue-400 hover:text-blue-300">
              Practice Mode
            </Link>
            <Form method="post" action="/logout" className="inline">
              <button type="submit" className="text-red-400 hover:text-red-300">
                Logout
              </button>
            </Form>
          </nav>
        </div>
      </header>

      <main className="p-6">
        {/* Trading History with Fixed Height and Scroll */}
        <div className="rounded-lg bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">Trading History</h2>
          <div className="max-h-[28rem] overflow-y-auto">
            {allTradingHistory.length > 0 ? (
              <div className="space-y-2">
                {allTradingHistory.map((trade, index) => (
                  <div
                    key={`${trade.timestamp}-${index}`}
                    className="rounded bg-gray-700 px-3"
                  >
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            trade.action === "buy"
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {trade.action.toUpperCase()}
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">{trade.ticker}</span>
                          <span className="ml-2 text-gray-300">
                            {trade.quantity}x {trade.shares} shares
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        <div>{new Date(trade.timestamp).toLocaleString()}</div>
                        {trade.messageId && (
                          <div>Msg Id: {trade.messageId.slice(-10)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-gray-400">
                  <svg
                    className="mx-auto mb-2 h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p>No trades yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">Controls</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-blue-400">
                Message Flow
              </h3>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>• Messages appear as popups when received</li>
                <li>• Multiple messages queue automatically</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-green-400">
                Trading Controls
              </h3>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>• Numbers: Select ticker (1-99)</li>
                <li>• C+number+Enter: Set shares | B: Buy | S: Sell</li>
                <li>• Enter: Confirm ticker | Backspace/Esc: Close/Edit</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
