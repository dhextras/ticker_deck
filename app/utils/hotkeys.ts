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
        if (newState.numberBuffer) {
          newState.numberBufferTimeout = setTimeout(() => {
            newState.numberBuffer = "";
            newState.numberBufferTimeout = undefined;
          }, 3000);
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
          if (newState.numberBufferTimeout) {
            clearTimeout(newState.numberBufferTimeout);
          }

          const singleDigit = parseInt(key);
          if (singleDigit >= 1 && singleDigit <= totalTickers) {
            // Check if we should extend the buffer or select immediately
            const extendedBuffer = newState.numberBuffer + key;
            const extendedNum = parseInt(extendedBuffer);

            if (extendedNum <= totalTickers && newState.numberBuffer !== "") {
              newState.numberBuffer = extendedBuffer;
              onTickerChange(extendedNum);

              // Set timeout to clear buffer after 1.5 seconds
              newState.numberBufferTimeout = setTimeout(() => {
                newState.numberBuffer = "";
                newState.numberBufferTimeout = undefined;
              }, 1500);
            } else {
              if (newState.numberBuffer !== "") {
                processCascadingSelection(
                  newState,
                  key,
                  totalTickers,
                  onTickerChange,
                );
              } else {
                newState.numberBuffer = key;
                onTickerChange(singleDigit);

                newState.numberBufferTimeout = setTimeout(() => {
                  newState.numberBuffer = "";
                  newState.numberBufferTimeout = undefined;
                }, 1500);
              }
            }
          } else {
            if (newState.numberBuffer !== "") {
              processCascadingSelection(
                newState,
                key,
                totalTickers,
                onTickerChange,
              );
            } else {
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

function processCascadingSelection(
  state: HotkeyState,
  newDigit: string,
  totalTickers: number,
  onTickerChange: (ticker: number) => void,
) {
  const currentBuffer = state.numberBuffer;
  const fullNumber = currentBuffer + newDigit;

  const fullNum = parseInt(fullNumber);
  if (fullNum >= 1 && fullNum <= totalTickers) {
    state.numberBuffer = fullNumber;
    onTickerChange(fullNum);

    // Set timeout to clear buffer
    state.numberBufferTimeout = setTimeout(() => {
      state.numberBuffer = "";
      state.numberBufferTimeout = undefined;
    }, 1500);
    return;
  }

  // Full number doesn't work, try cascading from left to right
  for (let i = 1; i <= currentBuffer.length; i++) {
    const partialOld = currentBuffer.substring(i);
    const testNumber = partialOld + newDigit;
    const testNum = parseInt(testNumber);

    if (testNum >= 1 && testNum <= totalTickers) {
      state.numberBuffer = testNumber;
      onTickerChange(testNum);

      state.numberBufferTimeout = setTimeout(() => {
        state.numberBuffer = "";
        state.numberBufferTimeout = undefined;
      }, 1500);
      return;
    }
  }

  const singleDigit = parseInt(newDigit);
  if (singleDigit >= 1 && singleDigit <= totalTickers) {
    state.numberBuffer = newDigit;
    onTickerChange(singleDigit);

    // Set timeout to clear buffer
    state.numberBufferTimeout = setTimeout(() => {
      state.numberBuffer = "";
      state.numberBufferTimeout = undefined;
    }, 1500);
  } else {
    state.numberBuffer = "";
  }
}
