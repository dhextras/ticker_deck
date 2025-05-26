import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import type { NotificationData, TestCase, TradingAction } from "~/types";
import { requireUserId } from "~/utils/auth.server";
import { createInitialHotkeyState, type HotkeyState } from "~/utils/hotkeys";

import KeyboardHandler from "~/components/KeyboardHandler";
import NotificationPopup from "~/components/NotificationPopup";
import ShareAmountInput from "~/components/ShareAmountInput";
import TickerSelector from "~/components/TickerSelector";

// Sample test cases
const sampleTestCases: TestCase[] = [
  {
    id: "easy_1",
    level: "easy",
    messages: [
      {
        sender: "TraderBot",
        name: "Signal Alert",
        title: "Buy Signal",
        content: "Strong uptrend detected",
        tickers: ["AAPL", "GOOGL", "MSFT"],
      },
    ],
    expectedActions: [
      {
        ticker: "AAPL",
        action: "buy",
        shares: 100,
        quantity: 1,
        timing: 10000,
      },
    ],
  },
  {
    id: "medium_1",
    level: "medium",
    messages: [
      {
        sender: "MarketAnalyst",
        name: "Multi-Ticker Alert",
        title: "Divergence Pattern",
        content: "Buy AAPL, Sell GOOGL",
        tickers: ["AAPL", "GOOGL", "MSFT", "TSLA"],
      },
    ],
    expectedActions: [
      {
        ticker: "AAPL",
        action: "buy",
        shares: 100,
        quantity: 1,
        timing: 15000,
      },
      {
        ticker: "GOOGL",
        action: "sell",
        shares: 100,
        quantity: 1,
        timing: 15000,
      },
    ],
  },
  {
    id: "hard_1",
    level: "hard",
    messages: [
      {
        sender: "AlgoTrader",
        name: "Complex Strategy",
        title: "Multi-Action Required",
        content: "Buy 3x AAPL, Sell 2x GOOGL, ignore others",
        tickers: ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"],
      },
    ],
    expectedActions: [
      {
        ticker: "AAPL",
        action: "buy",
        shares: 100,
        quantity: 3,
        timing: 20000,
      },
      {
        ticker: "GOOGL",
        action: "sell",
        shares: 100,
        quantity: 2,
        timing: 20000,
      },
    ],
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  return json({ userId, testCases: sampleTestCases });
}

export default function Practice() {
  const { userId, testCases } = useLoaderData<typeof loader>();

  // State management
  const [selectedLevel, setSelectedLevel] = useState<
    "easy" | "medium" | "hard"
  >("easy");
  const [currentTest, setCurrentTest] = useState<TestCase | null>(null);
  const [isTestActive, setIsTestActive] = useState(false);
  const [userActions, setUserActions] = useState<TradingAction[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [testResults, setTestResults] = useState<any>(null);

  // Trading state
  const [currentTickers, setCurrentTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState(1);
  const [shareAmount, setShareAmount] = useState(100);
  const [notification, setNotification] = useState<NotificationData | null>(
    null,
  );
  const [hotkeyState, setHotkeyState] = useState<HotkeyState>(
    createInitialHotkeyState,
  );

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTestActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1000) {
            endTest();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTestActive, timeRemaining]);

  const startTest = (testCase: TestCase) => {
    setCurrentTest(testCase);
    setIsTestActive(true);
    setUserActions([]);
    setStartTime(Date.now());
    setScore(0);
    setTestResults(null);

    // Set up the test environment
    const message = testCase.messages[0];
    setCurrentTickers(message.tickers);
    setSelectedTicker(1);

    // Set timer based on expected actions
    const maxTiming = Math.max(
      ...testCase.expectedActions.map((a) => a.timing || 30000),
    );
    setTimeRemaining(maxTiming);

    // Show the message
    const notificationData: NotificationData = {
      id: Date.now().toString(),
      title: `${message.sender} - ${message.name}`,
      message:
        message.title && message.content
          ? `${message.title}: ${message.content}`
          : message.title || message.content || "",
      timestamp: new Date().toISOString(),
      type: "info",
    };

    setNotification(notificationData);
  };

  const endTest = () => {
    if (!currentTest) return;

    setIsTestActive(false);

    // Calculate score
    const results = calculateScore(
      currentTest,
      userActions,
      Date.now() - startTime,
    );
    setTestResults(results);
    setScore(results.totalScore);
  };

  const calculateScore = (
    testCase: TestCase,
    actions: TradingAction[],
    totalTime: number,
  ) => {
    let correctActions = 0;
    let totalExpected = testCase.expectedActions.length;
    let speedBonus = 0;
    let details: any[] = [];

    testCase.expectedActions.forEach((expected) => {
      const matchingActions = actions.filter(
        (action) =>
          action.ticker === expected.ticker &&
          action.action === expected.action &&
          action.shares === expected.shares &&
          action.quantity === expected.quantity,
      );

      if (matchingActions.length > 0) {
        correctActions++;

        // Speed bonus if completed quickly
        const actionTime =
          new Date(matchingActions[0].timestamp).getTime() - startTime;
        if (expected.timing && actionTime < expected.timing * 0.5) {
          speedBonus += 20;
        }
      }

      details.push({
        expected,
        completed: matchingActions.length > 0,
        userActions: matchingActions,
      });
    });

    const accuracyScore = (correctActions / totalExpected) * 70;
    const totalScore = Math.round(accuracyScore + speedBonus);

    return {
      totalScore,
      accuracyScore: Math.round(accuracyScore),
      speedBonus: Math.round(speedBonus),
      correctActions,
      totalExpected,
      totalTime,
      details,
    };
  };

  const executeBuy = useCallback(
    (quantity: number) => {
      if (!isTestActive || currentTickers.length === 0) return;

      const action: TradingAction = {
        action: "buy",
        ticker: currentTickers[selectedTicker - 1],
        shares: shareAmount,
        quantity,
        timestamp: new Date().toISOString(),
      };

      setUserActions((prev) => [...prev, action]);

      // Show confirmation
      const notificationData: NotificationData = {
        id: Date.now().toString(),
        title: "Action Recorded",
        message: `Buy ${quantity}x ${shareAmount} shares of ${action.ticker}`,
        timestamp: new Date().toISOString(),
        type: "success",
      };
      setNotification(notificationData);
    },
    [isTestActive, currentTickers, selectedTicker, shareAmount],
  );

  const executeSell = useCallback(
    (quantity: number) => {
      if (!isTestActive || currentTickers.length === 0) return;

      const action: TradingAction = {
        action: "sell",
        ticker: currentTickers[selectedTicker - 1],
        shares: shareAmount,
        quantity,
        timestamp: new Date().toISOString(),
      };

      setUserActions((prev) => [...prev, action]);

      // Show confirmation
      const notificationData: NotificationData = {
        id: Date.now().toString(),
        title: "Action Recorded",
        message: `Sell ${quantity}x ${shareAmount} shares of ${action.ticker}`,
        timestamp: new Date().toISOString(),
        type: "success",
      };
      setNotification(notificationData);
    },
    [isTestActive, currentTickers, selectedTicker, shareAmount],
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

  const filteredTestCases = testCases.filter(
    (test) => test.level === selectedLevel,
  );

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
        <h1 className="text-2xl font-bold">Practice Mode</h1>
        <div className="flex items-center space-x-4">
          {isTestActive && (
            <div className="rounded-lg bg-blue-600 px-4 py-2">
              Time: {Math.ceil(timeRemaining / 1000)}s
            </div>
          )}
          <Link to="/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {!isTestActive && !testResults ? (
          /* Test Selection */
          <div className="space-y-6">
            {/* Level Selection */}
            <div className="rounded-lg bg-gray-800 p-6">
              <h2 className="mb-4 text-xl font-semibold">Select Difficulty</h2>
              <div className="flex space-x-4">
                {(["easy", "medium", "hard"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`rounded-lg px-6 py-3 font-medium capitalize transition-colors ${
                      selectedLevel === level
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Cases */}
            <div className="rounded-lg bg-gray-800 p-6">
              <h2 className="mb-4 text-xl font-semibold">
                {selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1)}{" "}
                Tests
              </h2>
              <div className="grid gap-4">
                {filteredTestCases.map((testCase) => (
                  <div key={testCase.id} className="rounded-lg bg-gray-700 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{testCase.id}</h3>
                        <p className="text-sm text-gray-400">
                          {testCase.expectedActions.length} expected actions
                        </p>
                      </div>
                      <button
                        onClick={() => startTest(testCase)}
                        className="btn-success"
                      >
                        Start Test
                      </button>
                    </div>

                    <div className="text-sm">
                      <p>
                        <strong>Message:</strong>{" "}
                        {testCase.messages[0].title ||
                          testCase.messages[0].content}
                      </p>
                      <p>
                        <strong>Tickers:</strong>{" "}
                        {testCase.messages[0].tickers.join(", ")}
                      </p>
                      <p>
                        <strong>Time Limit:</strong>{" "}
                        {Math.max(
                          ...testCase.expectedActions.map(
                            (a) => a.timing || 30000,
                          ),
                        ) / 1000}
                        s
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isTestActive ? (
          /* Active Test */
          <div className="space-y-6">
            {/* Test Info */}
            <div className="rounded-lg bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Test: {currentTest?.id}
                  </h2>
                  <p className="text-gray-400">
                    Actions completed: {userActions.length}
                  </p>
                </div>
                <button onClick={endTest} className="btn-danger">
                  End Test
                </button>
              </div>
            </div>

            {/* Share Amount Input */}
            <ShareAmountInput
              value={shareAmount}
              onChange={setShareAmount}
              isChangingViaHotkey={hotkeyState.isChangingShares}
              hotkeyBuffer={hotkeyState.shareChangeBuffer}
            />

            {/* Trading Actions */}
            <div className="rounded-lg bg-gray-800 p-4">
              <h3 className="mb-3 text-lg font-semibold">Manual Actions</h3>
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
            </div>

            {/* Ticker Selection */}
            <TickerSelector
              tickers={currentTickers}
              selectedTicker={selectedTicker}
              onTickerSelect={handleTickerChange}
            />

            {/* User Actions Log */}
            <div className="rounded-lg bg-gray-800 p-4">
              <h3 className="mb-3 text-lg font-semibold">Your Actions</h3>
              {userActions.length > 0 ? (
                <div className="space-y-2">
                  {userActions.map((action, index) => (
                    <div
                      key={index}
                      className="rounded bg-gray-700 p-2 text-sm"
                    >
                      <span
                        className={`font-semibold ${action.action === "buy" ? "text-green-400" : "text-red-400"}`}
                      >
                        {action.action.toUpperCase()}
                      </span>{" "}
                      {action.quantity}x {action.shares} shares of{" "}
                      {action.ticker}
                      <span className="ml-2 text-gray-400">
                        ({new Date(action.timestamp).toLocaleTimeString()})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No actions recorded yet</p>
              )}
            </div>
          </div>
        ) : (
          /* Test Results */
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-800 p-6">
              <h2 className="mb-4 text-2xl font-semibold">Test Results</h2>

              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {score}
                  </div>
                  <div className="text-gray-400">Total Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {testResults?.accuracyScore}
                  </div>
                  <div className="text-gray-400">Accuracy Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {testResults?.speedBonus}
                  </div>
                  <div className="text-gray-400">Speed Bonus</div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-lg">
                  <strong>Accuracy:</strong> {testResults?.correctActions}/
                  {testResults?.totalExpected} actions correct
                </p>
                <p className="text-lg">
                  <strong>Time:</strong>{" "}
                  {Math.round(testResults?.totalTime / 1000)}s
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Detailed Results:</h3>
                {testResults?.details.map((detail: any, index: number) => (
                  <div
                    key={index}
                    className={`rounded p-3 ${detail.completed ? "bg-green-900" : "bg-red-900"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {detail.expected.action.toUpperCase()}{" "}
                        {detail.expected.quantity}x {detail.expected.shares}{" "}
                        {detail.expected.ticker}
                      </span>
                      <span
                        className={`font-semibold ${detail.completed ? "text-green-400" : "text-red-400"}`}
                      >
                        {detail.completed ? "✓ Completed" : "✗ Missed"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => {
                    setTestResults(null);
                    setCurrentTest(null);
                  }}
                  className="btn-primary"
                >
                  Try Another Test
                </button>
                <button
                  onClick={() => currentTest && startTest(currentTest)}
                  className="btn-secondary"
                >
                  Retry Same Test
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
