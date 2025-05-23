import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
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
    return json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const userId = await verifyLogin(username, password);
  if (!userId) {
    return json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  return createUserSession(userId, "/dashboard");
}

export default function Login() {
  console.log("fdas")
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-bold text-center text-white">
            Trading Simulation
          </h1>
          <p className="mt-2 text-center text-gray-400">
            Sign in to start trading
          </p>
        </div>
        
        <Form method="post" className="mt-8 space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="input-field w-full mt-1"
              placeholder="Enter username"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input-field w-full mt-1"
              placeholder="Enter password"
            />
          </div>

          {actionData?.error && (
            <div className="bg-red-600 text-white p-3 rounded">
              {actionData.error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full">
            Sign In
          </button>
        </Form>
        
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Hotkeys Guide:</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li><code>B</code> - Buy (press multiple times for quantity)</li>
            <li><code>S</code> - Sell (press multiple times for quantity)</li>
            <li><code>1-9</code> - Switch tickers</li>
            <li><code>C + [number] + Enter</code> - Change share amount</li>
            <li><code>Backspace</code> - Close popup</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
