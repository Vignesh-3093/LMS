import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../../data-source";
import { User, UserRole } from "../entities/User";

export const managerAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.user?.id); // assume userId is in req.user via auth middleware
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneBy({ id: userId });

    if (!user || user.role !== UserRole.MANAGER) {
      return res.status(403).json({ message: "Forbidden: Managers only" });
    }
    next();
  } catch (error) {
    console.error("managerAuthMiddleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
