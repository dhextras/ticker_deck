import { createCookieSessionStorage, redirect } from "@remix-run/node";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

if (!process.env.USERNAME || !process.env.PASSWORD) {
  throw new Error("USERNAME and PASSWORD must be set in .env");
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  session.set("token", token);
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return session;
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getUserSession(request);
  const token = session.get("token");

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function requireUserId(request: Request): Promise<string> {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/");
  }

  return userId;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function verifyLogin(username: string, password: string): Promise<string | null> {
  const envUsername = process.env.USERNAME!;
  const envPassword = process.env.PASSWORD!;
  
  if (username !== envUsername) {
    return null;
  }
  
  // FIXME: For simplicity, we'll compare plain text passwords
  // In production, you'd hash the password in .env and compare hashes
  if (password !== envPassword) {
    return null;
  }
  
  return "user_1";
}

export function verifyToken(token: string): string | null {
  try {

  const urlDecoded = decodeURIComponent(token);

const [wrappedBase64, _] = urlDecoded.split(".");

const payload = JSON.parse(Buffer.from(wrappedBase64, "base64").toString("utf8"));

const actualJWT = payload.token;


    const decoded = jwt.verify(actualJWT, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}
