export interface HotkeyState {
  buyCount: number;
  sellCount: number;
  numberBuffer: string;
  isChangingShares: boolean;
  shareChangeBuffer: string;
  disabled: boolean;
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
      newState.sellCount = 0; // Reset sell count

      // Debounce buy actions - wait a bit to see if more 'b' presses come
      setTimeout(() => {
        if (newState.buyCount > 0) {
          onBuy(newState.buyCount);
          newState.buyCount = 0;
        }
      }, 100);
      break;

    case "s":
      newState.sellCount++;
      newState.buyCount = 0; // Reset buy count

      // Debounce sell actions
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
      break;

    case "enter":
      if (newState.isChangingShares && newState.shareChangeBuffer) {
        const shares = parseInt(newState.shareChangeBuffer);
        if (!isNaN(shares) && shares > 0) {
          onShareChange(shares);
        }
        newState.isChangingShares = false;
        newState.shareChangeBuffer = "";
      }
      break;

    case "backspace":
      if (newState.isChangingShares) {
        newState.shareChangeBuffer = newState.shareChangeBuffer.slice(0, -1);
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
          // Handle ticker selection
          newState.numberBuffer += key;

          // Try to select ticker immediately for single digit
          const tickerNum = parseInt(newState.numberBuffer);
          if (tickerNum <= totalTickers) {
            onTickerChange(tickerNum);

            // If single digit or if we've reached max possible ticker, clear buffer
            if (
              newState.numberBuffer.length === 1 ||
              tickerNum === totalTickers
            ) {
              newState.numberBuffer = "";
            }
          } else {
            // If number is too big, try removing last digit and selecting
            const fallbackTicker = parseInt(newState.numberBuffer.slice(0, -1));
            if (fallbackTicker > 0 && fallbackTicker <= totalTickers) {
              onTickerChange(fallbackTicker);
            }
            newState.numberBuffer = "";
          }

          // Clear number buffer after short delay
          setTimeout(() => {
            newState.numberBuffer = "";
          }, 1000);
        }

        newState.buyCount = 0;
        newState.sellCount = 0;
      }
      break;
  }

  return newState;
}
