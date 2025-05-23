import { AppDataSource } from "../../data-source";
import { Leave } from "../entities/Leaves";

export async function checkLeaveConflict(userId: number, startDate: string, endDate: string, excludeLeaveId?: number): Promise<boolean> {
  const leaveRepository = AppDataSource.getRepository(Leave);

  const conflicts = await leaveRepository
    .createQueryBuilder("leave")
    .where("leave.userId = :userId", { userId })
    .andWhere("leave.status = :status", { status: "APPROVED" })
    .andWhere("leave.startDate <= :endDate AND leave.endDate >= :startDate", { startDate, endDate })
    .andWhere(excludeLeaveId ? "leave.id != :excludeLeaveId" : "1=1", { excludeLeaveId })
    .getCount();

  return conflicts > 0;
}
