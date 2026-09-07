import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  createManagedUser,
  deleteUserById,
  findManagedUserById,
  listManagedUsers,
  updateManagedUser,
} from "../services/database/authStore.js";

export async function listUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const users = await listManagedUsers();
  res.json({ users });
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { username, password, role } = (req.body ?? {}) as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const created = await createManagedUser({ username, password, role });
  if (!created) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  res.status(201).json(created);
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }

  const { username, password, role } = (req.body ?? {}) as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const existing = await findManagedUserById(userId);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updated = await updateManagedUser(userId, { username, password, role });
  if (!updated) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  res.json(updated);
}

export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "userId must be a positive integer" });
    return;
  }

  const existing = await findManagedUserById(userId);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await deleteUserById(userId);
  res.status(204).send();
}