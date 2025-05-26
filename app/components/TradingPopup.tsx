import { useEffect, useState } from "react";

import type { HotkeyState } from "~/utils/hotkeys";
import type { TradingMessage } from "~/types";

interface TradingPopupProps {
  message: TradingMessage | null;
  onClose: () => void;
  onTrade: (action: "buy" | "sell", ticker: string, shares: number) => void;
  selectedTicker: number;
  shareAmount: number;
  hotkeyState: HotkeyState;
}

export default function TradingPopup({
  message,
  onClose,
  onTrade,
  selectedTicker,
  shareAmount,
  hotkeyState,
}: TradingPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [message]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleTrade = (action: "buy" | "sell") => {
    if (!message) return;
    const ticker = message.tickers[selectedTicker - 1];
    onTrade(action, ticker, shareAmount);
    handleClose();
  };

  if (!message) return null;

  const formatMessageText = () => {
    const parts = [];
    if (message.title) parts.push(`Title: ${message.title}`);
    if (message.content) parts.push(`Content: ${message.content}`);
    return parts;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-all duration-300 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className={`mx-4 w-full max-w-4xl transform rounded-xl bg-gray-800 shadow-2xl transition-all duration-300 ${
          isVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-white">
                {message.sender} - {message.name}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                {new Date(message.timestamp || "").toLocaleTimeString()}
              </p>
              <div className="mt-4">
                {formatMessageText().map((part, idx) => (
                  <p key={idx} className="text-lg leading-relaxed text-white">
                    {part}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="ml-4 text-gray-400 transition-colors hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Share Amount {hotkeyState.isChangingShares && "(Changing...)"}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={
                  hotkeyState.isChangingShares
                    ? hotkeyState.shareChangeBuffer
                    : shareAmount
                }
                readOnly
                className={`w-24 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white ${
                  hotkeyState.isChangingShares
                    ? "border-yellow-400 bg-yellow-900"
                    : ""
                }`}
              />
              <span className="text-xs text-gray-400">
                C + [number] + Enter
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Select Ticker (Number keys)
            </label>
            <div className="grid grid-cols-4 gap-1 md:grid-cols-6 lg:grid-cols-8">
              {message.tickers.map((ticker, index) => (
                <button
                  key={ticker}
                  onClick={() => {}}
                  className={`rounded border-2 p-1 text-xs transition-all ${
                    selectedTicker === index + 1
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <div className="font-mono font-bold">{index + 1}</div>
                  <div className="text-xs">{ticker}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => handleTrade("buy")}
              className="flex-1 rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              Buy (B) - {shareAmount} of {message.tickers[selectedTicker - 1]}
            </button>
            <button
              onClick={() => handleTrade("sell")}
              className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Sell (S) - {shareAmount} of {message.tickers[selectedTicker - 1]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
