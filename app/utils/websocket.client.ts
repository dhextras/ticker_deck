import { io, Socket } from "socket.io-client";
import type { TradingAction, TradingMessage } from "~/types";

let socket: Socket | null = null;

export function initSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  console.log(token);

  socket = io("http://localhost:3001", {
    auth: {
      token,
    },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function sendTradingAction(action: TradingAction) {
  if (socket && socket.connected) {
    socket.emit("trading_action", action);
  } else {
    console.error("Socket not connected");
  }
}

export function onMessage(callback: (message: TradingMessage) => void) {
  if (socket) {
    socket.on("trading_message", callback);
  }
}

export function onTradingResponse(callback: (response: any) => void) {
  if (socket) {
    socket.on("trading_response", callback);
  }
}

export function offMessage(callback: (message: TradingMessage) => void) {
  if (socket) {
    socket.off("trading_message", callback);
  }
}

export function offTradingResponse(callback: (response: any) => void) {
  if (socket) {
    socket.off("trading_response", callback);
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
