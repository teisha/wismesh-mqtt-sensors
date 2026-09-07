import { useEffect, useState } from "react";

import type { AuthUser } from "./api/client";
import { request } from "./api/client";
import LoginPage from "./components/LoginPage/LoginPage";
import MainShell from "./components/MainShell/MainShell";

type LoginResult = AuthUser;

type MeResult = AuthUser;

function App() {
  const [authState, setAuthState] = useState<{ loading: boolean; user: AuthUser | null }>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    let mounted = true;

    request<MeResult>("/auth/me")
      .then((data) => {
        if (mounted && data) {
          setAuthState({ loading: false, user: data });
        }
      })
      .catch(() => {
        if (mounted) {
          setAuthState({ loading: false, user: null });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(credentials: { username: string; password: string }) {
    const data = await request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (data) {
      setAuthState({ loading: false, user: data });
    }
  }

  async function handleLogout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setAuthState({ loading: false, user: null });
    }
  }

  if (authState.loading) {
    return <main className="shell">Checking session...</main>;
  }

  return authState.user ? <MainShell user={authState.user} onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}

export default App;
