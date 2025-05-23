import { useEffect, useRef } from "react";
import { handleKeyPress, type HotkeyState } from "~/utils/hotkeys";

interface KeyboardHandlerProps {
  hotkeyState: HotkeyState;
  totalTickers: number;
  onBuy: (quantity: number) => void;
  onSell: (quantity: number) => void;
  onTickerChange: (ticker: number) => void;
  onShareChange: (shares: number) => void;
  onDisableTemporary: () => void;
  onStateChange: (state: HotkeyState) => void;
}

export default function KeyboardHandler({
  hotkeyState,
  totalTickers,
  onBuy,
  onSell,
  onTickerChange,
  onShareChange,
  onDisableTemporary,
  onStateChange,
}: KeyboardHandlerProps) {
  const stateRef = useRef(hotkeyState);
  
  useEffect(() => {
    stateRef.current = hotkeyState;
  }, [hotkeyState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Prevent default for our hotkeys
      const key = e.key.toLowerCase();
      if (['b', 's', 'c', 'enter', 'backspace'].includes(key) || /\d/.test(key)) {
        e.preventDefault();
      }

      const newState = handleKeyPress(
        e.key,
        stateRef.current,
        totalTickers,
        onBuy,
        onSell,
        onTickerChange,
        onShareChange,
        onDisableTemporary
      );

      if (newState !== stateRef.current) {
        stateRef.current = newState;
        onStateChange(newState);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    totalTickers,
    onBuy,
    onSell,
    onTickerChange,
    onShareChange,
    onDisableTemporary,
    onStateChange,
  ]);

  return null; // This component doesn't render anything
}
