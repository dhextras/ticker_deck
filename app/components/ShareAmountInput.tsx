import { useEffect, useState } from "react";

interface ShareAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  isChangingViaHotkey: boolean;
  hotkeyBuffer: string;
}

export default function ShareAmountInput({
  value,
  onChange,
  isChangingViaHotkey,
  hotkeyBuffer,
}: ShareAmountInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const numValue = parseInt(newValue);
    if (!isNaN(numValue) && numValue > 0) {
      onChange(numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent hotkey handling when focused on input
    e.stopPropagation();
  };

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <label className="mb-2 block text-sm font-medium">Share Amount</label>

      <div className="flex items-center space-x-3">
        <input
          type="number"
          value={isChangingViaHotkey ? hotkeyBuffer : inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="input-field w-24 text-center"
          min="1"
          placeholder="100"
        />

        <div className="text-sm text-gray-400">
          {isChangingViaHotkey ? (
            <span className="text-yellow-400">
              Changing via hotkey: C + {hotkeyBuffer} + Enter
            </span>
          ) : (
            <span>Use: C + [number] + Enter for quick change</span>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Current amount will be used for each buy/sell action
      </div>
    </div>
  );
}
