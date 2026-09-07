import { Router } from "express";

import { createUser, deleteUser, listUsers, updateUser } from "../controllers/adminController.js";
import { requireAdmin, verifySession } from "../middleware/auth.js";

export function registerAdminRoutes(router: Router): void {
  router.get("/admin/users", verifySession, requireAdmin, listUsers);
  router.post("/admin/users", verifySession, requireAdmin, createUser);
  router.put("/admin/users/:userId", verifySession, requireAdmin, updateUser);
  router.delete("/admin/users/:userId", verifySession, requireAdmin, deleteUser);
}