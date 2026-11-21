"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, Input, Notice } from "@/components/admin/ui";
import { apiFetch, ClientApiError } from "@/lib/api-client";

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ mustChangePassword: boolean }>("/api/auth/login", { body: { username, password } });
      window.location.assign(r.mustChangePassword ? "/change-password" : next);
    } catch (err) {
      setError((err as ClientApiError).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Username" htmlFor="username">
        <Input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-11" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid h-8 w-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
        Sign in
      </Button>
      <p className="text-center text-[12.5px] text-muted">Forgot your password? Ask your administrator to reset it.</p>
    </form>
  );
}
