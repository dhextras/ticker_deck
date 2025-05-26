export interface HotkeyState {
  buyCount: number;
  sellCount: number;
  numberBuffer: string;
  isChangingShares: boolean;
  shareChangeBuffer: string;
  disabled: boolean;
  numberBufferTimeout?: NodeJS.Timeout;
}

export function createInitialHotkeyState(): HotkeyState {
  return {
    buyCount: 0,
    sellCount: 0,
    numberBuffer: "",
    isChangingShares: false,
    shareChangeBuffer: "",
    disabled: false,
  };
}

export function handleKeyPress(
  key: string,
  state: HotkeyState,
  totalTickers: number,
  onBuy: (quantity: number) => void,
  onSell: (quantity: number) => void,
  onTickerChange: (ticker: number) => void,
  onShareChange: (shares: number) => void,
  onDisableTemporary: () => void,
): HotkeyState {
  if (state.disabled) {
    return state;
  }

  const newState = { ...state };

  switch (key.toLowerCase()) {
    case "b":
      newState.buyCount++;
      newState.sellCount = 0;
      // Clear number buffer when trading
      newState.numberBuffer = "";
      if (newState.numberBufferTimeout) {
        clearTimeout(newState.numberBufferTimeout);
        newState.numberBufferTimeout = undefined;
      }

      setTimeout(() => {
        if (newState.buyCount > 0) {
          onBuy(newState.buyCount);
          newState.buyCount = 0;
        }
      }, 100);
      break;

    case "s":
      newState.sellCount++;
      newState.buyCount = 0;
      // Clear number buffer when trading
      newState.numberBuffer = "";
      if (newState.numberBufferTimeout) {
        clearTimeout(newState.numberBufferTimeout);
        newState.numberBufferTimeout = undefined;
      }

      setTimeout(() => {
        if (newState.sellCount > 0) {
          onSell(newState.sellCount);
          newState.sellCount = 0;
        }
      }, 100);
      break;

    case "c":
      newState.isChangingShares = true;
      newState.shareChangeBuffer = "";
      newState.buyCount = 0;
      newState.sellCount = 0;
      newState.numberBuffer = "";
      if (newState.numberBufferTimeout) {
        clearTimeout(newState.numberBufferTimeout);
        newState.numberBufferTimeout = undefined;
      }
      break;

    case "enter":
      if (newState.isChangingShares && newState.shareChangeBuffer) {
        const shares = parseInt(newState.shareChangeBuffer);
        if (!isNaN(shares) && shares > 0) {
          onShareChange(shares);
        }
        newState.isChangingShares = false;
        newState.shareChangeBuffer = "";
      } else if (newState.numberBuffer) {
        // Enter confirms ticker selection
        const tickerNum = parseInt(newState.numberBuffer);
        if (tickerNum >= 1 && tickerNum <= totalTickers) {
          onTickerChange(tickerNum);
        }
        newState.numberBuffer = "";
        if (newState.numberBufferTimeout) {
          clearTimeout(newState.numberBufferTimeout);
          newState.numberBufferTimeout = undefined;
        }
      }
      break;

    case "backspace":
    case "escape":
      if (newState.isChangingShares) {
        newState.shareChangeBuffer = newState.shareChangeBuffer.slice(0, -1);
      } else if (newState.numberBuffer) {
        // Remove last digit from number buffer
        newState.numberBuffer = newState.numberBuffer.slice(0, -1);
        if (newState.numberBufferTimeout) {
          clearTimeout(newState.numberBufferTimeout);
          newState.numberBufferTimeout = undefined;
        }

        // Set new timeout if buffer still has content
        // FIXME: who the fucks wants that i want it right away and keep it like for 3 secon before remoing instead okay now thats done we also need to show like whats the current buffer in that 3 seconds and make sure the keyboard also works
        if (newState.numberBuffer) {
          newState.numberBufferTimeout = setTimeout(() => {
            const tickerNum = parseInt(newState.numberBuffer);
            if (tickerNum >= 1 && tickerNum <= totalTickers) {
              onTickerChange(tickerNum);
            }
            newState.numberBuffer = "";
            newState.numberBufferTimeout = undefined;
          }, 1500);
        }
      } else {
        // Close popup and disable hotkeys temporarily
        onDisableTemporary();
        newState.disabled = true;
        setTimeout(() => {
          newState.disabled = false;
        }, 500);
      }
      break;

    default:
      if (/\d/.test(key)) {
        if (newState.isChangingShares) {
          newState.shareChangeBuffer += key;
        } else {
          // Clear any existing timeout
          if (newState.numberBufferTimeout) {
            clearTimeout(newState.numberBufferTimeout);
          }

          // Add digit to buffer
          newState.numberBuffer += key;

          // Check if current buffer is a valid ticker number
          const currentNum = parseInt(newState.numberBuffer);

          if (currentNum >= 1 && currentNum <= totalTickers) {
            // Set timeout to auto-select after 1.5 seconds
            newState.numberBufferTimeout = setTimeout(() => {
              const tickerNum = parseInt(newState.numberBuffer);
              if (tickerNum >= 1 && tickerNum <= totalTickers) {
                onTickerChange(tickerNum);
              }
              newState.numberBuffer = "";
              newState.numberBufferTimeout = undefined;
            }, 1500);
          } else {
            // If current number is too large, check if we can select with fewer digits
            const shorterNum = parseInt(newState.numberBuffer.slice(0, -1));
            if (shorterNum >= 1 && shorterNum <= totalTickers) {
              onTickerChange(shorterNum);
              newState.numberBuffer = key; // Start new buffer with current digit

              // Set timeout for the new buffer
              newState.numberBufferTimeout = setTimeout(() => {
                const tickerNum = parseInt(newState.numberBuffer);
                if (tickerNum >= 1 && tickerNum <= totalTickers) {
                  onTickerChange(tickerNum);
                }
                newState.numberBuffer = "";
                newState.numberBufferTimeout = undefined;
              }, 1500);
            } else {
              // Invalid number, clear buffer
              newState.numberBuffer = "";
            }
          }
        }

        // Reset trading counters when typing numbers
        newState.buyCount = 0;
        newState.sellCount = 0;
      }
      break;
  }

  return newState;
}
