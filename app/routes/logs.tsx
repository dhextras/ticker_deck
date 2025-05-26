import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { useMemo, useState } from "react";
import type { TradingLog } from "~/types";
import { requireUserId } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Read trading logs from file
  const logsPath = join(process.cwd(), "data", "trading-history.json");
  let logs: TradingLog[] = [];

  if (existsSync(logsPath)) {
    try {
      const fileContent = readFileSync(logsPath, "utf-8");
      logs = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading trading logs:", error);
    }
  }

  return json({ logs, userId });
}

export default function Logs() {
  const { logs, userId } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [filterAction, setFilterAction] = useState<string>(
    searchParams.get("action") || "all",
  );
  const [filterTicker, setFilterTicker] = useState<string>(
    searchParams.get("ticker") || "",
  );
  const [filterDate, setFilterDate] = useState<string>(
    searchParams.get("date") || "",
  );
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "timestamp",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("order") as "asc" | "desc") || "desc",
  );

  // Get unique tickers for filter dropdown
  const uniqueTickers = useMemo(() => {
    const tickers = new Set(logs.map((log) => log.ticker));
    return Array.from(tickers).sort();
  }, [logs]);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Filter by action
    if (filterAction !== "all") {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    // Filter by ticker
    if (filterTicker) {
      filtered = filtered.filter((log) =>
        log.ticker.toLowerCase().includes(filterTicker.toLowerCase()),
      );
    }

    // Filter by date
    if (filterDate) {
      filtered = filtered.filter((log) => log.timestamp.startsWith(filterDate));
    }

    // Sort logs
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "timestamp":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "action":
          comparison = a.action.localeCompare(b.action);
          break;
        case "ticker":
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case "shares":
          comparison = a.shares - b.shares;
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [logs, filterAction, filterTicker, filterDate, sortBy, sortOrder]);

  // Update URL params
  const updateFilters = () => {
    const params = new URLSearchParams();
    if (filterAction !== "all") params.set("action", filterAction);
    if (filterTicker) params.set("ticker", filterTicker);
    if (filterDate) params.set("date", filterDate);
    if (sortBy !== "timestamp") params.set("sort", sortBy);
    if (sortOrder !== "desc") params.set("order", sortOrder);

    setSearchParams(params);
  };

  // Export logs to CSV
  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Action",
      "Ticker",
      "Shares",
      "Quantity",
      "Success",
      "Error",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredLogs.map((log) =>
        [
          log.timestamp,
          log.action,
          log.ticker,
          log.shares,
          log.quantity,
          log.success,
          log.error || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading-logs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterAction("all");
    setFilterTicker("");
    setFilterDate("");
    setSortBy("timestamp");
    setSortOrder("desc");
    setSearchParams({});
  };

  // Statistics
  const stats = useMemo(() => {
    const totalTrades = logs.length;
    const successfulTrades = logs.filter((log) => log.success).length;
    const buyTrades = logs.filter((log) => log.action === "buy").length;
    const sellTrades = logs.filter((log) => log.action === "sell").length;
    const successRate =
      totalTrades > 0
        ? ((successfulTrades / totalTrades) * 100).toFixed(1)
        : "0";

    return {
      totalTrades,
      successfulTrades,
      buyTrades,
      sellTrades,
      successRate,
    };
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Trading Logs</h1>
        <div className="flex items-center space-x-4">
          <button onClick={exportToCSV} className="btn-success">
            Export CSV
          </button>
          <Link to="/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {stats.totalTrades}
            </div>
            <div className="text-sm text-gray-400">Total Trades</div>
          </div>
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {stats.successfulTrades}
            </div>
            <div className="text-sm text-gray-400">Successful</div>
          </div>
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-green-500">
              {stats.buyTrades}
            </div>
            <div className="text-sm text-gray-400">Buy Orders</div>
          </div>
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-red-500">
              {stats.sellTrades}
            </div>
            <div className="text-sm text-gray-400">Sell Orders</div>
          </div>
          <div className="rounded-lg bg-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {stats.successRate}%
            </div>
            <div className="text-sm text-gray-400">Success Rate</div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="input-field"
              >
                <option value="all">All Actions</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Ticker</label>
              <input
                type="text"
                value={filterTicker}
                onChange={(e) => setFilterTicker(e.target.value)}
                placeholder="Search ticker..."
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-field"
              >
                <option value="timestamp">Timestamp</option>
                <option value="action">Action</option>
                <option value="ticker">Ticker</option>
                <option value="shares">Shares</option>
                <option value="quantity">Quantity</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="input-field"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-2">
            <button onClick={updateFilters} className="btn-primary">
              Apply Filters
            </button>
            <button onClick={clearFilters} className="btn-secondary">
              Clear All
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Trading History ({filteredLogs.length} records)
            </h2>
          </div>

          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="p-2 text-left">Timestamp</th>
                    <th className="p-2 text-left">Action</th>
                    <th className="p-2 text-left">Ticker</th>
                    <th className="p-2 text-left">Shares</th>
                    <th className="p-2 text-left">Quantity</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-700 hover:bg-gray-700"
                    >
                      <td className="p-2">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-2">
                        <span
                          className={`font-semibold ${
                            log.action === "buy"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 font-mono">{log.ticker}</td>
                      <td className="p-2">{log.shares.toLocaleString()}</td>
                      <td className="p-2">{log.quantity}</td>
                      <td className="p-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            log.success
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {log.success ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-red-400">
                        {log.error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <p className="text-lg">No trading logs found</p>
              <p className="text-sm">
                Try adjusting your filters or start trading to see logs here
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
