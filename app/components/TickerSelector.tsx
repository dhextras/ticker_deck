interface TickerSelectorProps {
  tickers: string[];
  selectedTicker: number;
  onTickerSelect: (ticker: number) => void;
}

export default function TickerSelector({ tickers, selectedTicker, onTickerSelect }: TickerSelectorProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Select Ticker</h3>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {tickers.map((ticker, index) => {
          const tickerNumber = index + 1;
          const isSelected = selectedTicker === tickerNumber;
          
          return (
            <button
              key={tickerNumber}
              onClick={() => onTickerSelect(tickerNumber)}
              className={`ticker-box ${isSelected ? 'selected' : ''}`}
              title={`Ticker ${tickerNumber}: ${ticker}`}
            >
              <span className="font-bold">{tickerNumber}</span>
            </button>
          );
        })}
      </div>
      
      <div className="mt-3 text-sm text-gray-400">
        <p>
          Selected: <span className="text-white font-semibold">
            Ticker #{selectedTicker} ({tickers[selectedTicker - 1] || 'N/A'})
          </span>
        </p>
        <p className="mt-1">
          Use number keys (1-9) to select tickers quickly
        </p>
      </div>
    </div>
  );
}
