import { useState } from "react";

import type { AuthUser } from "../../api/client";
import MqttSendPage from "../MqttSendPage/MqttSendPage";
import UserMaintenancePage from "../UserMaintenancePage/UserMaintenancePage";

type MainShellProps = {
  user: AuthUser;
  onLogout: () => Promise<void>;
};

type MenuKey = "mqtt" | "users";

function MainShell({ user, onLogout }: MainShellProps) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("mqtt");

  return (
    <main className="shell dashboard-shell">
      <section className="card hero dashboard-hero">
        <div>
          <p className="eyebrow">Garden Hub</p>
          <h1>Tools Control Desk</h1>
          <p className="subcopy">Signed in as {user.username}. Pick a tool from the menu and keep adding more later.</p>
        </div>

        <div className="session-chip">
          <div>
            <p className="meta">Session</p>
            <strong>{user.role}</strong>
          </div>
          <button type="button" className="secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </section>

      <section className="dashboard-grid">
        <nav className="card menu-panel">
          <p className="eyebrow">Menu</p>
          <div className="menu-stack">
            <button type="button" className={activeMenu === "mqtt" ? "menu-button active" : "menu-button"} onClick={() => setActiveMenu("mqtt")}>
              <span>MQTT Send</span>
              <small>Publish commands and manage favorites</small>
            </button>

            <button
              type="button"
              className={activeMenu === "users" ? "menu-button active" : "menu-button"}
              onClick={() => setActiveMenu("users")}
              disabled={user.role !== "admin"}
            >
              <span>User Maintenance</span>
              <small>{user.role === "admin" ? "Manage usernames and passwords" : "Admin only"}</small>
            </button>
          </div>
        </nav>

        <section className="dashboard-content">
          {activeMenu === "mqtt" ? <MqttSendPage /> : null}
          {activeMenu === "users" ? <UserMaintenancePage /> : null}
          {user.role !== "admin" && activeMenu === "users" ? (
            <section className="card page-panel">
              <p className="subcopy">User maintenance is available to admin accounts only.</p>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default MainShell;