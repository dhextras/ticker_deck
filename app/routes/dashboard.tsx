import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import type { NotificationData, TradingAction, TradingMessage } from "~/types";
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

import KeyboardHandler from "~/components/KeyboardHandler";
import NotificationPopup from "~/components/NotificationPopup";
import ShareAmountInput from "~/components/ShareAmountInput";
import TickerSelector from "~/components/TickerSelector";

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

  const cookieHeader = request.headers.get("cookie");
  const token = getTokenFromCookie(cookieHeader, "ticker_deck_session");
  return json({ userId, token });
}

export default function Dashboard() {
  const { userId, token } = useLoaderData<typeof loader>();

  // State management
  const [currentTickers, setCurrentTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState(1);
  const [shareAmount, setShareAmount] = useState(100);
  const [notification, setNotification] = useState<NotificationData | null>(
    null,
  );
  const [hotkeyState, setHotkeyState] = useState<HotkeyState>(
    createInitialHotkeyState,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<TradingMessage | null>(null);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (token) {
      const socket = initSocket(token);

      socket.on("connect", () => {
        setIsConnected(true);
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  // Handle incoming messages
  const handleMessage = useCallback((message: TradingMessage) => {
    console.log("Received message:", message);

    // Update tickers if they exist
    if (message.tickers && message.tickers.length > 0) {
      setCurrentTickers(message.tickers);

      // Reset selected ticker if it's out of bounds
      setSelectedTicker((prev) => (prev > message.tickers.length ? 1 : prev));
    }

    // Don't show notification if both title and content are empty
    if (!message.title && !message.content) {
      return;
    }

    // Create notification
    let notificationText = "";
    if (message.title && message.content) {
      notificationText = `${message.title}: ${message.content}`;
    } else if (message.title) {
      notificationText = `title: ${message.title}`;
    } else if (message.content) {
      notificationText = `content: ${message.content}`;
    }

    const notificationData: NotificationData = {
      id: Date.now().toString(),
      title: `${message.sender} - ${message.name}`,
      message: notificationText,
      timestamp: message.timestamp || new Date().toISOString(),
      type: "info",
    };

    setNotification(notificationData);
    setLastMessage(message);

    // Show browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: "/favicon.ico",
      });
    }
  }, []);

  // Handle trading responses
  const handleTradingResponse = useCallback((response: any) => {
    console.log("Trading response:", response);

    const notificationData: NotificationData = {
      id: Date.now().toString(),
      title: response.success ? "Trade Executed" : "Trade Failed",
      message:
        response.message ||
        `${response.action} ${response.quantity}x ${response.shares} shares of ticker ${response.ticker}`,
      timestamp: new Date().toISOString(),
      type: response.success ? "success" : "error",
    };

    setNotification(notificationData);
  }, []);

  // Set up message listeners
  useEffect(() => {
    onMessage(handleMessage);
    onTradingResponse(handleTradingResponse);

    return () => {
      offMessage(handleMessage);
      offTradingResponse(handleTradingResponse);
    };
  }, [handleMessage, handleTradingResponse]);

  // Trading actions
  const executeBuy = useCallback(
    (quantity: number) => {
      if (currentTickers.length === 0) return;

      const action: TradingAction = {
        action: "buy",
        ticker: currentTickers[selectedTicker - 1] || currentTickers[0],
        shares: shareAmount,
        quantity,
        timestamp: new Date().toISOString(),
      };

      sendTradingAction(action);
    },
    [currentTickers, selectedTicker, shareAmount],
  );

  const executeSell = useCallback(
    (quantity: number) => {
      if (currentTickers.length === 0) return;

      const action: TradingAction = {
        action: "sell",
        ticker: currentTickers[selectedTicker - 1] || currentTickers[0],
        shares: shareAmount,
        quantity,
        timestamp: new Date().toISOString(),
      };

      sendTradingAction(action);
    },
    [currentTickers, selectedTicker, shareAmount],
  );

  const handleTickerChange = useCallback(
    (tickerNumber: number) => {
      if (tickerNumber >= 1 && tickerNumber <= currentTickers.length) {
        setSelectedTicker(tickerNumber);
      }
    },
    [currentTickers.length],
  );

  const handleDisableTemporary = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Keyboard Handler */}
      <KeyboardHandler
        hotkeyState={hotkeyState}
        totalTickers={currentTickers.length}
        onBuy={executeBuy}
        onSell={executeSell}
        onTickerChange={handleTickerChange}
        onShareChange={setShareAmount}
        onDisableTemporary={handleDisableTemporary}
        onStateChange={setHotkeyState}
      />

      {/* Notification Popup */}
      <NotificationPopup
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Header */}
      <header className="flex items-center justify-between bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Trading Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div
            className={`rounded-full px-3 py-1 text-sm ${
              isConnected ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          <nav className="space-x-4">
            <Link to="/practice" className="btn-secondary">
              Practice Mode
            </Link>
            <Link to="/logs" className="btn-secondary">
              Trading Logs
            </Link>
            <Form method="post" action="/logout" className="inline">
              <button type="submit" className="btn-danger">
                Logout
              </button>
            </Form>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="space-y-6 p-6">
        {/* Top Bar - Share Amount */}
        <ShareAmountInput
          value={shareAmount}
          onChange={setShareAmount}
          isChangingViaHotkey={hotkeyState.isChangingShares}
          hotkeyBuffer={hotkeyState.shareChangeBuffer}
        />

        {/* Trading Actions */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-gray-800 p-4">
            <h3 className="mb-3 text-lg font-semibold">Manual Trading</h3>
            <div className="space-x-4">
              <button
                onClick={() => executeBuy(1)}
                className="btn-success"
                disabled={currentTickers.length === 0}
              >
                Buy (B)
              </button>
              <button
                onClick={() => executeSell(1)}
                className="btn-danger"
                disabled={currentTickers.length === 0}
              >
                Sell (S)
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Use keyboard shortcuts for faster trading
            </p>
          </div>

          {/* Last Message */}
          <div className="rounded-lg bg-gray-800 p-4">
            <h3 className="mb-3 text-lg font-semibold">Last Message</h3>
            {lastMessage ? (
              <div className="text-sm">
                <p>
                  <strong>From:</strong> {lastMessage.sender} -{" "}
                  {lastMessage.name}
                </p>
                {lastMessage.title && (
                  <p>
                    <strong>Title:</strong> {lastMessage.title}
                  </p>
                )}
                {lastMessage.content && (
                  <p>
                    <strong>Content:</strong> {lastMessage.content}
                  </p>
                )}
                <p className="mt-1 text-gray-400">
                  Tickers: {lastMessage.tickers.join(", ")}
                </p>
              </div>
            ) : (
              <p className="text-gray-400">No messages received yet</p>
            )}
          </div>
        </div>

        {/* Ticker Selection */}
        {currentTickers.length > 0 ? (
          <TickerSelector
            tickers={currentTickers}
            selectedTicker={selectedTicker}
            onTickerSelect={handleTickerChange}
          />
        ) : (
          <div className="rounded-lg bg-gray-800 p-8 text-center">
            <p className="text-lg text-gray-400">
              Waiting for trading messages with ticker information...
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Once connected, you'll see available tickers here
            </p>
          </div>
        )}

        {/* Hotkey Status */}
        <div className="rounded-lg bg-gray-800 p-4">
          <h3 className="mb-3 text-lg font-semibold">Hotkey Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-gray-400">Buy Count:</span>
              <span className="ml-2 text-green-400">
                {hotkeyState.buyCount}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Sell Count:</span>
              <span className="ml-2 text-red-400">{hotkeyState.sellCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Number Buffer:</span>
              <span className="ml-2 text-blue-400">
                {hotkeyState.numberBuffer || "None"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span
                className={`ml-2 ${hotkeyState.disabled ? "text-red-400" : "text-green-400"}`}
              >
                {hotkeyState.disabled ? "Disabled" : "Active"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
