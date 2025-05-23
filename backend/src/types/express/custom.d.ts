// src/types/express/custom.d.ts
import { Request } from "express";
import { UserRole } from "../../entities/User";

export interface AuthRequest<P = {}> extends Request<P> {
  user?: {
    id: number;
    role: UserRole;
    email?: string;
  };
}
