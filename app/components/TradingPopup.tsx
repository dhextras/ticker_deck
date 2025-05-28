import { useEffect, useRef, useState } from "react";
import type { TradingMessage } from "~/types";
import type { HotkeyState } from "~/utils/hotkeys";
import { handleKeyPress } from "~/utils/hotkeys";

interface TradingPopupProps {
  message: TradingMessage | null;
  onClose: () => void;
  onTrade: (action: "buy" | "sell", ticker: string, shares: number) => void;
  selectedTicker: number;
  shareAmount: number;
  hotkeyState: HotkeyState;
  onTickerChange: (ticker: number) => void;
  onShareChange: (shares: number) => void;
  onStateChange: (state: HotkeyState) => void;
}

export default function TradingPopup({
  message,
  onClose,
  onTrade,
  selectedTicker,
  shareAmount,
  hotkeyState,
  onTickerChange,
  onShareChange,
  onStateChange,
}: TradingPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const stateRef = useRef(hotkeyState);

  useEffect(() => {
    stateRef.current = hotkeyState;
  }, [hotkeyState]);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [message]);

  // Keyboard handler effect
  useEffect(() => {
    if (!message) return; // Only handle keys when popup is open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input fields, but allow our hotkeys when not changing shares
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // If we're changing shares, only allow typing in the share input
        if (hotkeyState.isChangingShares) {
          const isOurShareInput =
            (e.target as HTMLInputElement).type === "number";
          if (!isOurShareInput) {
            return; // Block all other inputs when changing shares
          }
          // Only allow number keys, enter, backspace, escape for share changing
          const key = e.key.toLowerCase();
          if (
            !(/\d/.test(key) || ["enter", "backspace", "escape"].includes(key))
          ) {
            return;
          }
        } else {
          // Normal mode: allow hotkeys even when focused on our share input
          const isOurShareInput =
            (e.target as HTMLInputElement).type === "number";
          if (!isOurShareInput) {
            return;
          }
        }
      }

      // Prevent default for our hotkeys
      const key = e.key.toLowerCase();
      if (
        ["b", "s", "c", "enter", "backspace", "escape"].includes(key) ||
        /\d/.test(key)
      ) {
        e.preventDefault();
      }

      // Disable buy/sell/ticker selection when changing shares
      if (hotkeyState.isChangingShares) {
        if (["b", "s"].includes(key) || /\d/.test(key)) {
          // Only process numbers for share changing, block buy/sell
          if (
            /\d/.test(key) ||
            ["enter", "backspace", "escape"].includes(key)
          ) {
            const newState = handleKeyPress(
              e.key,
              stateRef.current,
              message.tickers.length,
              () => {}, // Disabled
              () => {}, // Disabled
              () => {}, // Disabled
              onShareChange,
              onClose,
            );

            if (newState !== stateRef.current) {
              stateRef.current = newState;
              onStateChange(newState);
            }
          }
          return;
        }
      }

      const newState = handleKeyPress(
        e.key,
        stateRef.current,
        message.tickers.length,
        (quantity) => {
          if (!hotkeyState.isChangingShares) {
            const ticker = message.tickers[selectedTicker - 1];
            if (ticker) onTrade("buy", ticker, quantity);
          }
        },
        (quantity) => {
          if (!hotkeyState.isChangingShares) {
            const ticker = message.tickers[selectedTicker - 1];
            if (ticker) onTrade("sell", ticker, quantity);
          }
        },
        (tickerNum) => {
          if (!hotkeyState.isChangingShares) {
            onTickerChange(tickerNum);
          }
        },
        onShareChange,
        onClose,
      );

      if (newState !== stateRef.current) {
        stateRef.current = newState;
        onStateChange(newState);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    message,
    selectedTicker,
    shareAmount,
    hotkeyState.isChangingShares,
    onTrade,
    onTickerChange,
    onShareChange,
    onClose,
    onStateChange,
  ]);

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose(e);
    }
  };

  const handleTickerSelect = (tickerIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTickerChange(tickerIndex + 1);
  };

  const handleTrade = (action: "buy" | "sell", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!message) return;

    const ticker = message.tickers[selectedTicker - 1];
    if (!ticker) return;

    // Don't close immediately, let the parent handle the trade result
    onTrade(action, ticker, shareAmount);
    // Remove the automatic close - let parent decide when to close
    // handleClose();
  };

  if (!message) return null;

  const highlightKeywords = (text: string) => {
    const keywords = [
      "adding",
      "add",
      "adds",
      "added",
      "long",
      "buy",
      "buying",
    ];

    let highlightedText = text;

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        (match) =>
          `<span class="bg-green-400 text-black px-1 rounded">${match}</span>`,
      );
    });

    return highlightedText;
  };

  const formatMessageText = () => {
    const parts = [];
    if (message.title) parts.push({ label: "Title", text: message.title });
    if (message.content)
      parts.push({ label: "Content", text: message.content });
    return parts;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-all duration-300 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`mx-4 w-full max-w-4xl transform rounded-xl bg-gray-800 shadow-2xl transition-all duration-300 ${
          isVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-white">
                [{message.sender}] - {message.name}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                {new Date(message.timestamp || "").toLocaleTimeString()}
              </p>
              <div className="mt-4">
                {formatMessageText().map((part, idx) => (
                  <p key={idx} className="text-lg leading-relaxed text-white">
                    <span className="font-bold">{part.label}: </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightKeywords(part.text),
                      }}
                    />
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
              Share Amount{" "}
              {hotkeyState.isChangingShares && (
                <span className="font-bold text-yellow-400">(Changing...)</span>
              )}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={
                  hotkeyState.isChangingShares
                    ? hotkeyState.shareChangeBuffer
                    : shareAmount
                }
                onClick={(e) => {
                  // Prevent default click behavior
                  e.preventDefault();
                  e.stopPropagation();

                  // Dispatch 'c' keydown event
                  document.body.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "c", bubbles: true }),
                  );
                }}
                className={`w-24 rounded border px-2 py-1 text-sm text-white transition-all focus:outline-none ${
                  hotkeyState.isChangingShares
                    ? "border-yellow-400 bg-yellow-900 text-yellow-100 ring-2 ring-yellow-400/50"
                    : "border-gray-600 bg-gray-700 focus:border-blue-500"
                }`}
                min="1"
                readOnly={hotkeyState.isChangingShares}
                placeholder={
                  hotkeyState.isChangingShares ? "Type number..." : ""
                }
              />

              <span className="text-xs text-gray-400">
                {hotkeyState.isChangingShares
                  ? "Type number + Enter to confirm"
                  : "C + [number] + Enter or click to edit"}
              </span>
            </div>
            {hotkeyState.isChangingShares && (
              <div className="mt-2 rounded border border-yellow-400/50 bg-yellow-900/50 px-3 py-2">
                <div className="text-sm text-yellow-200">
                  <span className="font-bold">Share Change Mode Active</span>
                </div>
                <div className="mt-1 text-xs text-yellow-300">
                  Type the number of shares and press Enter to confirm, or
                  Escape to cancel
                </div>
              </div>
            )}
          </div>

          {/* Show current number buffer if active */}
          {hotkeyState.numberBuffer && !hotkeyState.isChangingShares && (
            <div className="mb-4">
              <div className="rounded border border-blue-500 bg-blue-900/70 px-3 py-2">
                <div className="text-sm text-blue-200">
                  Current selection:{" "}
                  <span className="font-mono font-bold text-blue-100">
                    {hotkeyState.numberBuffer}
                  </span>
                </div>
                <div className="mt-1 text-xs text-blue-300">
                  Will clear in 1.5 seconds or press another number to extend
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Select Ticker{" "}
              {hotkeyState.isChangingShares ? (
                <span className="text-gray-500">
                  (Disabled - Finish share change first)
                </span>
              ) : (
                "(Number keys or click)"
              )}
            </label>
            <div className="grid grid-cols-4 gap-1 md:grid-cols-6 lg:grid-cols-8">
              {message.tickers.map((ticker, index) => (
                <button
                  key={ticker}
                  onClick={(e) =>
                    !hotkeyState.isChangingShares &&
                    handleTickerSelect(index, e)
                  }
                  disabled={hotkeyState.isChangingShares}
                  className={`rounded border-2 p-1 text-xs transition-all ${
                    hotkeyState.isChangingShares
                      ? "cursor-not-allowed border-gray-700 bg-gray-800 text-gray-600"
                      : selectedTicker === index + 1
                        ? "border-blue-500 bg-blue-600 text-white shadow-lg hover:scale-105"
                        : "border-gray-600 bg-gray-700 text-gray-300 hover:scale-105 hover:border-gray-500 hover:bg-gray-600"
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
              onClick={(e) =>
                !hotkeyState.isChangingShares && handleTrade("buy", e)
              }
              disabled={hotkeyState.isChangingShares}
              className={`flex-1 rounded px-4 py-2 text-sm font-semibold text-white transition-all ${
                hotkeyState.isChangingShares
                  ? "cursor-not-allowed bg-gray-600 opacity-50"
                  : "bg-green-600 hover:scale-105 hover:bg-green-700 active:scale-95"
              }`}
            >
              {hotkeyState.isChangingShares
                ? "Buy (Disabled)"
                : `Buy (B) - ${shareAmount} of ${message.tickers[selectedTicker - 1]}`}
            </button>
            <button
              onClick={(e) =>
                !hotkeyState.isChangingShares && handleTrade("sell", e)
              }
              disabled={hotkeyState.isChangingShares}
              className={`flex-1 rounded px-4 py-2 text-sm font-semibold text-white transition-all ${
                hotkeyState.isChangingShares
                  ? "cursor-not-allowed bg-gray-600 opacity-50"
                  : "bg-red-600 hover:scale-105 hover:bg-red-700 active:scale-95"
              }`}
            >
              {hotkeyState.isChangingShares
                ? "Sell (Disabled)"
                : `Sell (S) - ${shareAmount} of ${message.tickers[selectedTicker - 1]}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
