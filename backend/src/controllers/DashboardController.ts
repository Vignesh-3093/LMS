import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Leave } from "../entities/Leaves";
import { User } from "../entities/User";

export class DashboardController {
  static async getTeamLeaveStats(req: Request, res: Response) {
    try {
      const leaveRepository = AppDataSource.getRepository(Leave);

      const leaves = await leaveRepository
        .createQueryBuilder("leave")
        .leftJoinAndSelect("leave.user", "user")
        .select("user.team", "team")
        .addSelect("COUNT(leave.id)", "leaveCount")
        .groupBy("user.team")
        .getRawMany();

      return res.json(leaves);
    } catch (error) {
      console.error("getTeamLeaveStats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getMonthlyTrends(req: Request, res: Response) {
    try {
      const leaveRepository = AppDataSource.getRepository(Leave);

      const leaves = await leaveRepository
        .createQueryBuilder("leave")
        .select("DATE_TRUNC('month', leave.startDate)", "month")
        .addSelect("COUNT(leave.id)", "leaveCount")
        .groupBy("month")
        .orderBy("month", "ASC")
        .getRawMany();

      return res.json(leaves);
    } catch (error) {
      console.error("getMonthlyTrends error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
