"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { idToken, login } = useAuth();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (idToken) router.replace("/dashboard");
  }, [idToken, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">Login</h1>

        <div className="mb-5 flex justify-center [&>div]:!w-full">
          <GoogleLogin
            onSuccess={(credential) => {
              if (credential.credential) login(credential.credential);
            }}
            onError={() => setNotice("Google login failed. Please try again.")}
            width="100%"
          />
        </div>

        <div className="mb-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          or sign up through email
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNotice("Email/password login isn't wired up — please continue with Google above.");
          }}
          className="space-y-3"
        >
          <input
            type="email"
            placeholder="Email ID"
            className="w-full rounded-lg bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            Login
          </button>
        </form>

        {notice && <p className="mt-4 text-center text-xs text-amber-600">{notice}</p>}
      </div>
    </main>
  );
}
