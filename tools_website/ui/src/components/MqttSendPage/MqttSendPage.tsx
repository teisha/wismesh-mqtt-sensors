import { useEffect, useMemo, useState, type FormEvent } from "react";

import { request } from "../../api/client";
import Dialog from "../common/Dialog";

type PublishResult = {
  topic: string;
  payloadBytes: number;
};

type FavoriteRecord = {
  id: number;
  userId: number;
  name: string;
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  createdAt: number;
  updatedAt: number;
};

type FavoriteFormState = {
  name: string;
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
};

const initialPayload = "ping";

const initialForm = {
  topic: "garden/commands/test",
  payload: initialPayload,
  qos: 0,
  retain: false,
};

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MqttSendPage() {
  const [form, setForm] = useState(initialForm);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "ok"; message: string }>({
    type: "idle",
    message: "",
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<FavoriteRecord | null>(null);
  const [favoriteForm, setFavoriteForm] = useState<FavoriteFormState>({
    name: "",
    topic: initialForm.topic,
    payload: initialForm.payload,
    qos: initialForm.qos,
    retain: initialForm.retain,
  });

  const payloadBytes = useMemo(() => new TextEncoder().encode(form.payload).length, [form.payload]);

  async function loadFavorites() {
    setLoadingFavorites(true);

    try {
      const data = await request<{ favorites: FavoriteRecord[] }>("/mqtt/favorites");
      setFavorites(data?.favorites ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load favorites";
      setStatus({ type: "error", message });
    } finally {
      setLoadingFavorites(false);
    }
  }

  useEffect(() => {
    void loadFavorites();
  }, []);

  function openCreateFavorite() {
    setEditingFavorite(null);
    setFavoriteForm({
      name: "",
      topic: form.topic,
      payload: form.payload,
      qos: form.qos,
      retain: form.retain,
    });
    setEditorOpen(true);
  }

  function openEditFavorite(favorite: FavoriteRecord) {
    setEditingFavorite(favorite);
    setFavoriteForm({
      name: favorite.name,
      topic: favorite.topic,
      payload: favorite.payload,
      qos: favorite.qos,
      retain: favorite.retain,
    });
    setEditorOpen(true);
  }

  function loadFavoriteIntoForm(favorite: FavoriteRecord) {
    setForm({
      topic: favorite.topic,
      payload: favorite.payload,
      qos: favorite.qos,
      retain: favorite.retain,
    });
    setStatus({ type: "ok", message: `Loaded ${favorite.name} into the send form.` });
  }

  async function publishPayload(topic: string, payloadText: string, qos: number, retain: boolean) {
    const result = await request<PublishResult>("/mqtt/publish", {
      method: "POST",
      body: JSON.stringify({
        topic,
        payload: payloadText,
        qos,
        retain,
      }),
    });

    if (result) {
      setStatus({
        type: "ok",
        message: `Published to ${result.topic} (${result.payloadBytes} bytes).`,
      });
    }
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    try {
      await publishPayload(form.topic, form.payload, Number(form.qos), Boolean(form.retain));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      setStatus({ type: "error", message });
    }
  }

  async function handleSendFavorite(favorite: FavoriteRecord) {
    setStatus({ type: "idle", message: "" });

    try {
      await publishPayload(favorite.topic, favorite.payload, favorite.qos, favorite.retain);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      setStatus({ type: "error", message });
    }
  }

  async function handleSaveFavorite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    try {
      const body = {
        name: favoriteForm.name,
        topic: favoriteForm.topic,
        payload: favoriteForm.payload,
        qos: Number(favoriteForm.qos),
        retain: Boolean(favoriteForm.retain),
      };

      if (editingFavorite) {
        await request<FavoriteRecord>(`/mqtt/favorites/${editingFavorite.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await request<FavoriteRecord>("/mqtt/favorites", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setEditorOpen(false);
      await loadFavorites();
      setStatus({ type: "ok", message: `Saved ${favoriteForm.name} as a favorite.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save favorite";
      setStatus({ type: "error", message });
    }
  }

  async function handleDeleteFavorite(favorite: FavoriteRecord) {
    if (!window.confirm(`Delete favorite ${favorite.name}?`)) {
      return;
    }

    try {
      await request(`/mqtt/favorites/${favorite.id}`, { method: "DELETE" });
      await loadFavorites();
      setStatus({ type: "ok", message: `Deleted ${favorite.name}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete favorite";
      setStatus({ type: "error", message });
    }
  }

  return (
    <section className="page-grid">
      <article className="card page-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">MQTT</p>
            <h2>Send</h2>
          </div>
          <button type="button" className="secondary" onClick={openCreateFavorite}>
            Save as Favorite
          </button>
        </div>

        <form onSubmit={handlePublish} className="stack">
          <label>
            Topic
            <input
              type="text"
              value={form.topic}
              onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}
              required
            />
          </label>

          <label>
            Message
            <textarea
              rows={11}
              value={form.payload}
              onChange={(event) => setForm((current) => ({ ...current, payload: event.target.value }))}
              required
            />
          </label>

          <div className="row">
            <label>
              QoS
              <select
                value={form.qos}
                onChange={(event) => setForm((current) => ({ ...current, qos: Number(event.target.value) }))}
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.retain}
                onChange={(event) => setForm((current) => ({ ...current, retain: event.target.checked }))}
              />
              Retain
            </label>
          </div>

          <div className="panel-footer">
            <p className="meta">Payload size: {payloadBytes} bytes</p>
            <button type="submit">Publish to MQTT</button>
          </div>
        </form>
      </article>

      <aside className="card page-panel favorites-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Favorites</p>
            <h2>Quick Resend</h2>
          </div>
          <button type="button" className="secondary" onClick={loadFavorites}>
            Refresh
          </button>
        </div>

        {loadingFavorites ? <p className="subcopy">Loading favorites...</p> : null}

        {!loadingFavorites && favorites.length === 0 ? (
          <p className="subcopy">Save a few commands here to resend them quickly later.</p>
        ) : null}

        <div className="favorites-list">
          {favorites.map((favorite) => (
            <article className="favorite-item" key={favorite.id}>
              <div className="favorite-body">
                <div>
                  <h3>{favorite.name}</h3>
                  <p className="meta">{favorite.topic}</p>
                </div>
                <div className="favorite-tags">
                  <span>QoS {favorite.qos}</span>
                  {favorite.retain ? <span>Retain</span> : null}
                </div>
                <p className="favorite-updated">Updated {formatDateTime(favorite.updatedAt)}</p>
              </div>

              <div className="favorite-actions">
                <button type="button" onClick={() => loadFavoriteIntoForm(favorite)}>
                  Load
                </button>
                <button type="button" className="secondary" onClick={() => handleSendFavorite(favorite)}>
                  Send
                </button>
                <button type="button" className="secondary" onClick={() => openEditFavorite(favorite)}>
                  Edit
                </button>
                <button type="button" className="danger" onClick={() => handleDeleteFavorite(favorite)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </aside>

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingFavorite ? "Edit Favorite" : "New Favorite"}
        description="Store a reusable MQTT command with topic, payload, QoS, and retain settings."
        footer={
          <>
            <button type="submit" form="favorite-form">
              Save Favorite
            </button>
            <button type="button" className="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </button>
          </>
        }
      >
        <form id="favorite-form" onSubmit={handleSaveFavorite} className="stack">
          <label>
            Name
            <input
              type="text"
              value={favoriteForm.name}
              onChange={(event) =>
                setFavoriteForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Pump test"
              required
            />
          </label>

          <label>
            Topic
            <input
              type="text"
              value={favoriteForm.topic}
              onChange={(event) =>
                setFavoriteForm((current) => ({ ...current, topic: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Message
            <textarea
              rows={10}
              value={favoriteForm.payload}
              onChange={(event) =>
                setFavoriteForm((current) => ({ ...current, payload: event.target.value }))
              }
              required
            />
          </label>

          <div className="row">
            <label>
              QoS
              <select
                value={favoriteForm.qos}
                onChange={(event) =>
                  setFavoriteForm((current) => ({ ...current, qos: Number(event.target.value) }))
                }
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={favoriteForm.retain}
                onChange={(event) =>
                  setFavoriteForm((current) => ({ ...current, retain: event.target.checked }))
                }
              />
              Retain
            </label>
          </div>
        </form>
      </Dialog>

      {status.message ? (
        <section className={`status ${status.type === "error" ? "error" : "ok"}`}>{status.message}</section>
      ) : null}
    </section>
  );
}

export default MqttSendPage;