// src/types/express/index.d.ts

import { User, UserRole } from "../../entities/User";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: UserRole;
      };
    }
  }
}

export {};
