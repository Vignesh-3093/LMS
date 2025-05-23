// src/types/express/index.d.ts
import { UserRole } from "../../entities/User"; // Make sure you export UserRole from User.ts or adjust accordingly
import { User } from "../../entities/User";

declare global {
  namespace Express {
    interface Request {
      user?:{
        id: number;
        role: UserRole | String;
        email: string;
      };
    }
  }
}

export {};
