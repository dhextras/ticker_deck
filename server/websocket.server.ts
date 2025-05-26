import { Server as SocketIOServer } from "socket.io";
import type { TradingAction, TradingMessage } from "../app/types";
import { verifyToken } from "../app/utils/auth.server";
import { logTradingAction } from "./logger";

export function setupWebSocket(io: SocketIOServer) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const userId = verifyToken(token);

    if (!userId) {
      return next(new Error("Invalid token"));
    }

    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`User ${socket.data.userId} connected`);

    // Handle trading actions
    socket.on("trading_action", async (action: TradingAction) => {
      try {
        console.log(`Trading action from ${socket.data.userId}:`, action);

        // Validate action
        if (
          !action.action ||
          !action.ticker ||
          !action.shares ||
          !action.quantity
        ) {
          socket.emit("trading_response", {
            success: false,
            message: "Invalid trading action",
            error: "Missing required fields",
          });
          return;
        }

        // Process multiple orders (quantity support)
        const responses = [];
        for (let i = 0; i < action.quantity; i++) {
          // Log each individual action
          const logResult = await logTradingAction({
            timestamp: new Date().toISOString(),
            userId: socket.data.userId,
            action: action.action,
            ticker: action.ticker,
            shares: action.shares,
            quantity: 1, // Each log entry is for 1 execution
            success: true,
          });

          responses.push({
            orderNumber: i + 1,
            action: action.action,
            ticker: action.ticker,
            shares: action.shares,
          });
        }

        // Send confirmation back
        socket.emit("trading_response", {
          success: true,
          message: `${action.action.toUpperCase()} order executed: ${action.quantity}x ${action.shares} shares of ${action.ticker}`,
          action: action.action,
          ticker: action.ticker,
          shares: action.shares,
          quantity: action.quantity,
          timestamp: new Date().toISOString(),
          orders: responses,
        });
      } catch (error) {
        console.error("Error processing trading action:", error);

        // Log failed action
        await logTradingAction({
          timestamp: new Date().toISOString(),
          userId: socket.data.userId,
          action: action.action,
          ticker: action.ticker,
          shares: action.shares,
          quantity: action.quantity,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        socket.emit("trading_response", {
          success: false,
          message: "Trading action failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Handle incoming trading messages (simulated market messages)
    socket.on("send_trading_message", (message: TradingMessage) => {
      try {
        console.log(
          `Broadcasting message from ${socket.data.userId}:`,
          message,
        );

        // Validate message structure
        if (!message.sender || !message.name || !message.tickers?.length) {
          socket.emit("message_error", {
            error: "Invalid message format",
            message: "Missing required fields: sender, name, or tickers",
          });
          return;
        }

        // Check if message should be sent (title or content present)
        const hasTitle = message.title && message.title.trim() !== "";
        const hasContent = message.content && message.content.trim() !== "";

        if (!hasTitle && !hasContent) {
          console.log("Message not sent - no title or content");
          return;
        }

        // Format message for display
        let displayMessage = "";
        if (hasTitle && hasContent) {
          displayMessage = `title: ${message.title} content: ${message.content}`;
        } else if (hasTitle) {
          displayMessage = `title: ${message.title}`;
        } else if (hasContent) {
          displayMessage = `content: ${message.content}`;
        }

        // Add timestamp if not present
        const messageWithTimestamp: TradingMessage = {
          ...message,
          timestamp: message.timestamp || new Date().toISOString(),
        };

        // Broadcast to all connected clients
        io.emit("trading_message", {
          ...messageWithTimestamp,
          displayMessage,
        });

        console.log(`Message broadcasted: ${displayMessage}`);
      } catch (error) {
        console.error("Error processing trading message:", error);
        socket.emit("message_error", {
          error: "Failed to process message",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`User ${socket.data.userId} disconnected: ${reason}`);
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.data.userId}:`, error);
    });

    // Send welcome message
    socket.emit("connection_success", {
      message: "Successfully connected to trading server",
      userId: socket.data.userId,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle server-level errors
  io.on("error", (error) => {
    console.error("Socket.IO server error:", error);
  });

  console.log("WebSocket server setup complete");
}
