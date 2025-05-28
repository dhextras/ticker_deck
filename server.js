import { createRequestHandler } from "@remix-run/express";
import dotenv from "dotenv";
import express from "express";
import http from "http";

dotenv.config();
const app = express();
const server = http.createServer(app);

const viteDevServer =
  // eslint-disable-next-line no-undef
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

app.use(
  viteDevServer ? viteDevServer.middlewares : express.static("build/client"),
);

const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");

app.all("*", createRequestHandler({ build }));

const PORT = process.env.FRONTEND_PORT || 3000;

server.listen(PORT, () => {
  console.log(`App listening on http://localhost:${PORT}`);
});
