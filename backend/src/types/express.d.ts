// src/types/express.d.ts

import * as express from "express";
import { User } from "../../entities/User";
import { UserRole } from "../entities/User";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: UserRole;
    }
    interface Request {
      user?: User;
    }
  }
}
