"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Неверный логин или пароль");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Неверный логин или пароль");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md rounded-3xl border border-border bg-white shadow-soft">
        <CardContent className="space-y-5 p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-2xl border border-border bg-white p-1">
              <img src="/smart-sklad-cube.png" alt="Smart Sklad cube logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-ink">Smart Sklad CRM</h1>
            <p className="text-sm text-muted">Войдите в систему для доступа к складу, магазинам и движениям.</p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">Email или Login</label>
              <Input
                type="text"
                placeholder="логин или you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? "Вход..." : "Войти"}
            </Button>

            <p className="text-center text-xs text-muted">Забыли пароль? Обратитесь к администратору системы.</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
