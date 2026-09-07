import { useState, type FormEvent } from "react";

type LoginCredentials = {
  username: string;
  password: string;
};

type LoginPageProps = {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
};

function LoginPage({ onLogin }: LoginPageProps) {
  const [form, setForm] = useState<LoginCredentials>({
    username: "admin",
    password: "",
  });
  const [status, setStatus] = useState<{ type: "idle" | "error" | "ok"; message: string }>({
    type: "idle",
    message: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    console.info("Submitting login request", { username: form.username });

    try {
      await onLogin(form);
      setForm((current) => ({ ...current, password: "" }));
      console.info("Login request succeeded", { username: form.username });
      setStatus({ type: "ok", message: "Signed in." });
    } catch (error) {
      console.error("Login request failed", error);
      const message = error instanceof Error ? error.message : "Login failed";
      setStatus({ type: "error", message });
    }
  }

  return (
    <main className="shell auth-shell">
      <section className="card hero auth-hero">
        <p className="eyebrow">Garden Hub</p>
        <h1>Tools Control Desk</h1>
        <p className="subcopy">
          Sign in to open the dashboard, manage users, and resend MQTT favorites from one place.
        </p>
      </section>

      <section className="card auth-card">
        <form onSubmit={handleSubmit} className="stack">
          <h2>Log In</h2>
          <label>
            Username
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit">Sign In</button>

          {status.message ? (
            <p className={`status ${status.type === "error" ? "error" : "ok"}`}>{status.message}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

export default LoginPage;