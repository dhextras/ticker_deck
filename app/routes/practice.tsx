import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, Link, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import { requireUserId } from "~/utils/auth.server";
import type { TradingMessage, TradingAction } from "~/types";
import { createInitialHotkeyState, type HotkeyState } from "~/utils/hotkeys";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

import TradingPopup from "~/components/TradingPopup";
import NotificationPopup from "~/components/NotificationPopup";

interface PracticeLevel {
  level: "easy" | "medium" | "hard";
  name: string;
  description: string;
  testCases: string[];
  requiredScore: number;
  timeLimit: number;
}

interface TestCase {
  id: string;
  level: "easy" | "medium" | "hard";
  messages: TradingMessage[];
  expectedActions: {
    ticker: string;
    action: "buy" | "sell";
    shares: number;
    quantity: number;
    timing: number;
  }[];
}

interface LeaderboardEntry {
  userId: string;
  level: "easy" | "medium" | "hard";
  attempts: Array<{
    time: number;
    score: number;
    timestamp: string;
  }>;
  bestTime: number;
  bestScore: number;
  testCount: number;
  averageScore: number;
  lastUpdated: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const levelsPath = join(process.cwd(), "data", "practice-levels.json");
  let practiceLevels: PracticeLevel[] = [];

  if (existsSync(levelsPath)) {
    try {
      const fileContent = readFileSync(levelsPath, "utf-8");
      practiceLevels = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading practice levels:", error);
    }
  }

  const testCasesPath = join(process.cwd(), "data", "test-cases.json");
  let testCases: TestCase[] = [];

  if (existsSync(testCasesPath)) {
    try {
      const fileContent = readFileSync(testCasesPath, "utf-8");
      testCases = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading test cases:", error);
    }
  }

  const leaderboardPath = join(
    process.cwd(),
    "data",
    "practice-leaderboard.json",
  );
  let leaderboard: LeaderboardEntry[] = [];

  if (existsSync(leaderboardPath)) {
    try {
      const fileContent = readFileSync(leaderboardPath, "utf-8");
      leaderboard = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading leaderboard:", error);
    }
  }

  return json({
    userId,
    practiceLevels,
    testCases,
    leaderboard,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    const { userId, level, bestTime, bestScore, testCount, averageScore } =
      data;

    if (
      !userId ||
      !level ||
      typeof bestTime !== "number" ||
      typeof bestScore !== "number"
    ) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const leaderboardPath = join(
      process.cwd(),
      "data",
      "practice-leaderboard.json",
    );
    let leaderboard: LeaderboardEntry[] = [];

    if (existsSync(leaderboardPath)) {
      try {
        const fileContent = readFileSync(leaderboardPath, "utf-8");
        leaderboard = JSON.parse(fileContent);
      } catch (error) {
        console.error("Error reading leaderboard:", error);
      }
    }

    const existingEntryIndex = leaderboard.findIndex(
      (entry) => entry.userId === userId && entry.level === level,
    );

    const newAttempt = {
      time: bestTime,
      score: bestScore,
      timestamp: new Date().toISOString(),
    };

    if (existingEntryIndex >= 0) {
      const existing = leaderboard[existingEntryIndex];
      existing.attempts.push(newAttempt);

      if (existing.attempts.length > 30) {
        existing.attempts = existing.attempts.slice(-30);
      }

      existing.bestTime = Math.min(existing.bestTime, bestTime);
      existing.bestScore = Math.max(existing.bestScore, bestScore);
      existing.testCount = existing.testCount + testCount;
      existing.averageScore = averageScore;
      existing.lastUpdated = new Date().toISOString();
    } else {
      const newEntry: LeaderboardEntry = {
        userId,
        level,
        attempts: [newAttempt],
        bestTime,
        bestScore,
        testCount,
        averageScore,
        lastUpdated: new Date().toISOString(),
      };
      leaderboard.push(newEntry);
    }

    writeFileSync(leaderboardPath, JSON.stringify(leaderboard, null, 2));
    return json({ success: true });
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

export default function Practice() {
  const { userId, practiceLevels, testCases, leaderboard } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [selectedLevel, setSelectedLevel] = useState<
    "easy" | "medium" | "hard"
  >("easy");
  const [selectedTestCount, setSelectedTestCount] = useState(1);
  const [isTestActive, setIsTestActive] = useState(false);
  const [testQueue, setTestQueue] = useState<TestCase[]>([]);
  const [messageQueue, setMessageQueue] = useState<TradingMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<TradingMessage | null>(
    null,
  );
  const [userActions, setUserActions] = useState<TradingAction[]>([]);
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [messageStartTime, setMessageStartTime] = useState<number>(0);
  const [completedTests, setCompletedTests] = useState<any[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [finalResults, setFinalResults] = useState<any>(null);
  const [selectedTicker, setSelectedTicker] = useState(1);
  const [shareAmount, setShareAmount] = useState(5000);
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [hotkeyState, setHotkeyState] = useState<HotkeyState>(
    createInitialHotkeyState(),
  );

  // Add the missing effect for message queue progression
  useEffect(() => {
    if (messageQueue.length > 0 && !currentMessage && isTestActive) {
      const nextMessage = messageQueue[0];
      setCurrentMessage(nextMessage);
      setMessageQueue((prev) => prev.slice(1));
      setMessageStartTime(Date.now());
      setSelectedTicker(1);
    }
  }, [messageQueue, currentMessage, isTestActive]);

  const getCurrentLevel = () =>
    practiceLevels.find((level) => level.level === selectedLevel);
  const getAvailableTestCases = () =>
    testCases.filter((test) => test.level === selectedLevel);

  const startPracticeSession = useCallback(() => {
    const availableTests = getAvailableTestCases();
    if (availableTests.length === 0) return;

    setHotkeyState(createInitialHotkeyState());
    const shuffled = [...availableTests].sort(() => Math.random() - 0.5);
    const selectedTests = shuffled.slice(
      0,
      Math.min(selectedTestCount, shuffled.length),
    );

    setTestQueue(selectedTests);
    setCurrentTestIndex(0);
    setCompletedTests([]);
    setUserActions([]);
    setIsTestActive(true);
    setTestStartTime(Date.now());
    setFinalResults(null);
    setMessageQueue([]);
    setCurrentMessage(null);

    startNextTest(selectedTests[0]);
  }, [selectedLevel, selectedTestCount, testCases]);

  const startNextTest = useCallback((testCase: TestCase) => {
    setUserActions([]);
    setSelectedTicker(1);
    setHotkeyState(createInitialHotkeyState());

    // Queue all messages from this test case
    if (testCase.messages.length > 0) {
      setMessageQueue(testCase.messages);
    }
  }, []);

  const handleTrade = useCallback(
    (action: "buy" | "sell", ticker: string, shares: number) => {
      if (!currentMessage || !isTestActive) return;

      const currentTime = Date.now();
      const timeSinceMessage = currentTime - messageStartTime;

      const tradingAction: TradingAction = {
        action,
        ticker,
        shares,
        quantity: 1,
        timestamp: new Date().toISOString(),
        messageId: currentMessage.id,
        timingMs: timeSinceMessage,
      };

      setUserActions((prev) => [...prev, tradingAction]);

      const notificationData = {
        id: Date.now().toString(),
        title: "Action Recorded",
        message: `${action.toUpperCase()} ${shares} shares of ${ticker} (${timeSinceMessage}ms)`,
        timestamp: new Date().toISOString(),
        type: "success" as const,
      };
      setNotification(notificationData);
    },
    [currentMessage, isTestActive, messageStartTime],
  );

  const handleClosePopup = useCallback(() => {
    setCurrentMessage(null);

    // If no more messages in queue, finish this test
    if (messageQueue.length === 0) {
      const currentTest = testQueue[currentTestIndex];
      if (currentTest) {
        const testResults = calculateTestResults(
          currentTest,
          userActions,
          testStartTime,
        );
        setCompletedTests((prev) => [...prev, testResults]);

        const nextTestIndex = currentTestIndex + 1;
        if (nextTestIndex < testQueue.length) {
          setCurrentTestIndex(nextTestIndex);
          startNextTest(testQueue[nextTestIndex]);
        } else {
          finishPracticeSession();
        }
      }
    }
  }, [
    messageQueue.length,
    testQueue,
    currentTestIndex,
    userActions,
    testStartTime,
  ]);

  const finishPracticeSession = useCallback(() => {
    const totalTime = Date.now() - testStartTime;
    const allResults = [...completedTests];

    const currentTest = testQueue[currentTestIndex];
    if (currentTest && userActions.length > 0) {
      const lastTestResults = calculateTestResults(
        currentTest,
        userActions,
        testStartTime,
      );
      allResults.push(lastTestResults);
    }

    const totalScore = allResults.reduce(
      (sum, result) => sum + result.totalScore,
      0,
    );
    const averageScore =
      allResults.length > 0 ? totalScore / allResults.length : 0;
    const bestTime = Math.min(...allResults.map((r) => r.totalTime));

    const sessionResults = {
      level: selectedLevel,
      testCount: allResults.length,
      totalScore,
      averageScore,
      bestTime,
      totalTime,
      results: allResults,
    };

    setFinalResults(sessionResults);
    setIsTestActive(false);
    setCurrentMessage(null);
    setMessageQueue([]);

    saveToLeaderboard(sessionResults);
  }, [
    testStartTime,
    completedTests,
    testQueue,
    currentTestIndex,
    userActions,
    selectedLevel,
  ]);

  const calculateTestResults = (
    testCase: TestCase,
    actions: TradingAction[],
    startTime: number,
  ) => {
    let correctActions = 0;
    let totalExpected = testCase.expectedActions.length;
    let speedBonus = 0;
    let accuracyPenalty = 0;
    let details: any[] = [];

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    testCase.expectedActions.forEach((expected) => {
      const matchingActions = actions.filter(
        (action) =>
          action.ticker === expected.ticker &&
          action.action === expected.action &&
          action.shares === expected.shares,
      );

      let isCorrect = false;
      let timingScore = 0;

      if (matchingActions.length > 0) {
        const action = matchingActions[0];
        isCorrect = action.quantity === expected.quantity;

        if (isCorrect) {
          correctActions++;

          const actionTime = action.timingMs || 0;
          if (actionTime <= expected.timing * 0.5) {
            speedBonus += 30;
            timingScore = 30;
          } else if (actionTime <= expected.timing) {
            speedBonus += 15;
            timingScore = 15;
          }
        }

        if (action.quantity !== expected.quantity) {
          accuracyPenalty += 10;
        }
      }

      details.push({
        expected,
        completed: isCorrect,
        userActions: matchingActions,
        timingScore,
        actionTime: matchingActions[0]?.timingMs || null,
      });
    });

    const extraActions = actions.filter(
      (action) =>
        !testCase.expectedActions.some(
          (expected) =>
            expected.ticker === action.ticker &&
            expected.action === action.action,
        ),
    );
    accuracyPenalty += extraActions.length * 5;

    const accuracyScore = Math.max(
      0,
      (correctActions / totalExpected) * 70 - accuracyPenalty,
    );
    const totalScore = Math.round(Math.max(0, accuracyScore + speedBonus));

    return {
      testId: testCase.id,
      totalScore,
      accuracyScore: Math.round(accuracyScore),
      speedBonus: Math.round(speedBonus),
      accuracyPenalty: Math.round(accuracyPenalty),
      correctActions,
      totalExpected,
      extraActions: extraActions.length,
      totalTime,
      details,
    };
  };

  const saveToLeaderboard = (sessionResults: any) => {
    fetcher.submit(
      {
        userId,
        level: selectedLevel,
        bestTime: sessionResults.bestTime,
        bestScore: Math.max(
          ...sessionResults.results.map((r: any) => r.totalScore),
        ),
        testCount: sessionResults.testCount,
        averageScore: sessionResults.averageScore,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleTickerChange = useCallback((ticker: number) => {
    setSelectedTicker(ticker);
  }, []);

  const handleShareChange = useCallback((shares: number) => {
    setShareAmount(shares);
  }, []);

  const currentLevel = getCurrentLevel();
  const availableTests = getAvailableTestCases();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TradingPopup
        message={currentMessage}
        onClose={handleClosePopup}
        onTrade={handleTrade}
        onTickerChange={handleTickerChange}
        onShareChange={handleShareChange}
        selectedTicker={selectedTicker}
        shareAmount={shareAmount}
        hotkeyState={hotkeyState}
        onStateChange={setHotkeyState}
      />

      <NotificationPopup
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <header className="flex items-center justify-between bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Practice Mode</h1>
        <div className="flex items-center space-x-4">
          {isTestActive ? (
            <div className="flex items-center space-x-2 text-green-500">
              <div>
                Test: {currentTestIndex + 1}/{testQueue.length}
              </div>
              {messageQueue.length > 0 && (
                <span className="rounded-full bg-green-600 px-2 py-1 text-xs">
                  {messageQueue.length} messages queued
                </span>
              )}
            </div>
          ) : finalResults ? (
            <button
              onClick={() => setFinalResults(null)}
              className="text-blue-400 hover:text-blue-300"
            >
              Practice Mode
            </button>
          ) : (
            <Link to="/dashboard" className="text-blue-400 hover:text-blue-300">
              Trading Dashboard
            </Link>
          )}
          <Form method="post" action="/logout" className="inline">
            <button type="submit" className="text-red-400 hover:text-red-300">
              Logout
            </button>
          </Form>
        </div>
      </header>

      <main className="p-6">
        {!isTestActive && !finalResults ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg bg-gray-800 p-4 lg:col-span-2">
                <h2 className="mb-3 text-lg font-semibold">
                  Select Practice Level
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  {practiceLevels.map((level) => (
                    <button
                      key={level.level}
                      onClick={() => setSelectedLevel(level.level)}
                      className={`rounded-lg p-3 text-left transition-colors ${
                        selectedLevel === level.level
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      <h3 className="text-sm font-semibold capitalize">
                        {level.level}
                      </h3>
                      <p className="text-xs text-gray-200">{level.name}</p>
                      <p className="text-xs text-gray-400">
                        {level.description}
                      </p>
                      <p className="mt-1 text-xs">
                        {
                          testCases.filter((t) => t.level === level.level)
                            .length
                        }{" "}
                        available tests
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {currentLevel && (
                <div className="rounded-lg bg-gray-800 p-4">
                  <h2 className="mb-3 text-lg font-semibold">Configure</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          Test Cases:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={availableTests.length}
                            value={selectedTestCount}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              const clampedValue = Math.max(
                                1,
                                Math.min(availableTests.length, value),
                              );
                              setSelectedTestCount(clampedValue);
                            }}
                            className="w-16 rounded bg-gray-700 px-2 py-1 text-xs text-white"
                          />
                          <span className="text-xs text-gray-400">
                            / {availableTests.length}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-gray-400">
                        <div>Time: {currentLevel.timeLimit / 1000}s</div>
                        <div>Target: {currentLevel.requiredScore}%</div>
                      </div>
                    </div>

                    <button
                      onClick={startPracticeSession}
                      disabled={availableTests.length === 0}
                      className="w-full rounded bg-green-600 px-3 py-2 text-xs font-medium hover:bg-green-700 disabled:bg-gray-600"
                    >
                      Start Practice
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-gray-800 p-4">
              <h2 className="mb-4 text-lg font-semibold">
                Leaderboard & Your Stats
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {["easy", "medium", "hard"].map((level) => {
                  const allAttempts = leaderboard
                    .filter((entry) => entry.level === level)
                    .flatMap((entry) =>
                      entry.attempts.map((attempt) => ({
                        ...attempt,
                        userId: entry.userId,
                      })),
                    )
                    .sort((a, b) => b.score - a.score || a.time - b.time)
                    .slice(0, 5);

                  const userEntry = leaderboard.find(
                    (entry) => entry.userId === userId && entry.level === level,
                  );

                  const allLevelEntries = leaderboard
                    .filter((entry) => entry.level === level)
                    .sort(
                      (a, b) =>
                        b.bestScore - a.bestScore || a.bestTime - b.bestTime,
                    );

                  const userRank = userEntry
                    ? allLevelEntries.findIndex(
                        (entry) => entry.userId === userId,
                      ) + 1
                    : null;

                  return (
                    <div key={level} className="rounded-lg bg-gray-700 p-3">
                      <h3 className="mb-3 text-center text-sm font-semibold capitalize">
                        {level}
                      </h3>

                      {userEntry && (
                        <div className="mb-3 rounded-lg bg-blue-900/50 p-2">
                          <div className="mb-1 text-xs font-semibold text-blue-400">
                            Your Performance
                          </div>
                          <div className="space-y-1 text-xs">
                            <div>
                              Rank:{" "}
                              <span className="font-medium">#{userRank}</span>{" "}
                              of {allLevelEntries.length} players
                            </div>
                            <div>
                              Best:{" "}
                              <span className="font-medium">
                                {userEntry.bestScore} pts
                              </span>{" "}
                              • {userEntry.bestTime / 1000}s
                            </div>
                            <div>
                              Attempts:{" "}
                              <span className="font-medium">
                                {userEntry.attempts.length}
                              </span>{" "}
                              • Avg: {userEntry.averageScore}
                            </div>
                          </div>
                        </div>
                      )}

                      {allAttempts.length > 0 ? (
                        <div className="space-y-1">
                          <div className="mb-2 text-center text-xs font-medium text-gray-300">
                            🏆 Top 5 Runs
                          </div>
                          {allAttempts.map((attempt, index) => {
                            const isCurrentUser = attempt.userId === userId;
                            const rankIcon =
                              index === 0
                                ? "🥇"
                                : index === 1
                                  ? "🥈"
                                  : index === 2
                                    ? "🥉"
                                    : `#${index + 1}`;

                            return (
                              <div
                                key={`${attempt.userId}-${attempt.timestamp}`}
                                className={`flex items-center justify-between rounded-lg p-2 text-xs ${
                                  isCurrentUser
                                    ? "bg-blue-900/30 font-medium text-blue-300"
                                    : "text-gray-300"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="min-w-[16px] text-xs">
                                    {rankIcon}
                                  </span>
                                  <span>
                                    {attempt.userId}
                                    {isCurrentUser && " (You)"}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">
                                    {attempt.score} pts
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {attempt.time / 1000}s
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="mb-1 text-xs text-gray-400">
                            No records yet
                          </p>
                          <p className="text-xs text-gray-500">
                            Be the first to play!
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : finalResults ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-800 p-6">
              <h2 className="mb-4 text-2xl font-semibold">Session Results</h2>

              <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {Math.round(finalResults.averageScore)}
                  </div>
                  <div className="text-gray-400">Avg Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {finalResults.testCount}
                  </div>
                  <div className="text-gray-400">Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {finalResults.bestTime / 1000}s
                  </div>
                  <div className="text-gray-400">Best Time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {finalResults.totalTime / 1000}s
                  </div>
                  <div className="text-gray-400">Total Time</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Individual Test Results:
                </h3>
                {finalResults.results.map((result: any, index: number) => (
                  <div key={index} className="rounded bg-gray-700 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold">
                        Test {index + 1}: {result.testId}
                      </h4>
                      <div className="flex space-x-4 text-sm">
                        <span className="text-blue-400">
                          Score: {result.totalScore}
                        </span>
                        <span className="text-green-400">
                          Time: {result.totalTime / 1000}s
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300">
                      <p>
                        Accuracy: {result.correctActions}/{result.totalExpected}{" "}
                        ({Math.round(result.accuracyScore)})
                      </p>
                      <p>Speed Bonus: {result.speedBonus}</p>
                      {result.extraActions > 0 && (
                        <p className="text-red-400">
                          Extra Actions: {result.extraActions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => setFinalResults(null)}
                  className="rounded bg-blue-600 px-6 py-2 hover:bg-blue-700"
                >
                  New Session
                </button>
                <button
                  onClick={startPracticeSession}
                  className="rounded bg-green-600 px-6 py-2 hover:bg-green-700"
                >
                  Retry Same Config
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Active Session - {selectedLevel.toUpperCase()}
                  </h2>
                  <p className="text-gray-400">
                    Test {currentTestIndex + 1} of {testQueue.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    Current Test: {currentTestIndex}
                  </p>
                  <p className="text-sm text-gray-400">
                    Actions: {userActions.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-800 p-4">
              <h3 className="mb-3 text-lg font-semibold">
                Actions for the test
              </h3>
              {userActions.length > 0 ? (
                <div className="space-y-2">
                  {userActions.map((action, index) => (
                    <div
                      key={index}
                      className="rounded bg-gray-700 p-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          <span
                            className={`font-semibold ${action.action === "buy" ? "text-green-400" : "text-red-400"}`}
                          >
                            {action.action.toUpperCase()}
                          </span>{" "}
                          {action.shares} shares of {action.ticker}
                        </span>
                        <span className="text-gray-400">
                          {action.timingMs}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No actions recorded yet</p>
              )}
            </div>

            {/* Controls Help */}
            <div className="rounded-lg bg-gray-800 p-4">
              <h3 className="mb-3 text-lg font-semibold">Controls</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-blue-400">
                    Navigation
                  </h4>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>
                      • Numbers: Select ticker (1-
                      {currentMessage?.tickers.length || 0})
                    </li>
                    <li>• Enter: Confirm selection</li>
                    <li>• Backspace/Esc: Close popup</li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-green-400">
                    Trading
                  </h4>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>• B: Buy current ticker</li>
                    <li>• S: Sell current ticker</li>
                    <li>• C+number+Enter: Set share amount</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
