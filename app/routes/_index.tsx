import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { createUserSession, getUserId, verifyLogin } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  const userId = await verifyLogin(username, password);
  if (!userId) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }

  return createUserSession(userId, "/dashboard");
}

export default function Login() {
  console.log("fdas");
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md space-y-8 p-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-white">
            Trading Simulation
          </h1>
          <p className="mt-2 text-center text-gray-400">
            Sign in to start trading
          </p>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-300"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="input-field mt-1 w-full"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input-field mt-1 w-full"
              placeholder="Enter password"
            />
          </div>

          {actionData?.error && (
            <div className="rounded bg-red-600 p-3 text-white">
              {actionData.error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full">
            Sign In
          </button>
        </Form>

        <div className="mt-6 rounded-lg bg-gray-800 p-4">
          <h3 className="mb-2 text-sm font-medium text-gray-300">
            Hotkeys Guide:
          </h3>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>
              <code>B</code> - Buy (press multiple times for quantity)
            </li>
            <li>
              <code>S</code> - Sell (press multiple times for quantity)
            </li>
            <li>
              <code>1-9</code> - Switch tickers
            </li>
            <li>
              <code>C + [number] + Enter</code> - Change share amount
            </li>
            <li>
              <code>Backspace</code> - Close popup
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
