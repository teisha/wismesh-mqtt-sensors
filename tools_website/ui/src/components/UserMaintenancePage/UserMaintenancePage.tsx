import { useEffect, useState, type FormEvent } from "react";

import { request } from "../../api/client";
import Dialog from "../common/Dialog";

type ManagedUser = {
  id: number;
  username: string;
  role: string;
  createdAt: number;
  lastLoginAt: number | null;
};

type UserFormState = {
  username: string;
  password: string;
  role: string;
};

function formatDateTime(value: number | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function UserMaintenancePage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "ok"; message: string }>({
    type: "idle",
    message: "",
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    username: "",
    password: "",
    role: "user",
  });

  async function loadUsers() {
    setLoadingUsers(true);

    try {
      const data = await request<{ users: ManagedUser[] }>("/admin/users");
      setUsers(data?.users ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load users";
      setStatus({ type: "error", message });
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function openCreateUser() {
    setEditingUser(null);
    setUserForm({ username: "", password: "", role: "user" });
    setEditorOpen(true);
  }

  function openEditUser(user: ManagedUser) {
    setEditingUser(user);
    setUserForm({ username: user.username, password: "", role: user.role });
    setEditorOpen(true);
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    try {
      const body = {
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
      };

      if (editingUser) {
        await request<ManagedUser>(`/admin/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify({
            username: body.username,
            role: body.role,
            ...(body.password ? { password: body.password } : {}),
          }),
        });
      } else {
        await request<ManagedUser>("/admin/users", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setEditorOpen(false);
      await loadUsers();
      setStatus({
        type: "ok",
        message: editingUser ? `Updated ${userForm.username}.` : `Created ${userForm.username}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save user";
      setStatus({ type: "error", message });
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    if (!window.confirm(`Delete user ${user.username}?`)) {
      return;
    }

    try {
      await request(`/admin/users/${user.id}`, { method: "DELETE" });
      await loadUsers();
      setStatus({ type: "ok", message: `Deleted ${user.username}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user";
      setStatus({ type: "error", message });
    }
  }

  return (
    <section className="card page-panel users-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>User Maintenance</h2>
        </div>
        <button type="button" onClick={openCreateUser}>
          Add User
        </button>
      </div>

      {loadingUsers ? <p className="subcopy">Loading users...</p> : null}

      {!loadingUsers ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEditUser(user)}>
                        Modify
                      </button>
                      <button type="button" className="danger" onClick={() => handleDeleteUser(user)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingUser ? `Edit ${editingUser.username}` : "Add User"}
        description="Create an account or change the password for an existing one. Leave password blank when editing to keep the current value."
        footer={
          <>
            <button type="submit" form="user-form">
              Save User
            </button>
            <button type="button" className="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSaveUser} className="stack">
          <label>
            Username
            <input
              type="text"
              value={userForm.username}
              onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
              required
            />
          </label>

          <label>
            Password {editingUser ? <span className="field-hint">(optional for edits)</span> : null}
            <input
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
              required={!editingUser}
              autoComplete="new-password"
            />
          </label>

          <label>
            Role
            <select
              value={userForm.role}
              onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </form>
      </Dialog>

      {status.message ? (
        <section className={`status ${status.type === "error" ? "error" : "ok"}`}>{status.message}</section>
      ) : null}
    </section>
  );
}

export default UserMaintenancePage;