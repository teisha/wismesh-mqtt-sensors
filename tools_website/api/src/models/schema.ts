import { SessionModel } from "./session.model.js";
import { FavoriteModel } from "./favorite.model.js";
import { UserModel } from "./user.model.js";

export const favorites = FavoriteModel.table;
export const users = UserModel.table;
export const sessions = SessionModel.table;

export { FavoriteModel, SessionModel, UserModel };
export type { NewFavoriteRecord, FavoriteRecord } from "./favorite.model.js";
export type { NewSessionRecord, SessionRecord } from "./session.model.js";
export type { NewUserRecord, UserRecord } from "./user.model.js";
