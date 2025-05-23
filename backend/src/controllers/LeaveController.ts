import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Leave, LeaveStatus } from "../entities/Leaves";
import { User } from "../entities/User";
import { mapLeavesToCalendarEvents } from "../utils/calenderUtils";

export const applyLeave = async (req: Request, res: Response) => {
  try {
    const partialUser = req.user!;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: partialUser.id });

    if (!user) return res.status(404).json({ message: "User not found" });

    const { startDate, endDate, type, reason } = req.body;
    const leaveRepo = AppDataSource.getRepository(Leave);
    const leave = leaveRepo.create({
      startDate,
      endDate,
      type,
      reason,
      user,
      status: LeaveStatus.PENDING,
    });

    await leaveRepo.save(leave);
    return res.status(201).json({ message: "Leave applied successfully", leave });
  } catch (error) {
    console.error("Error in applyLeave:", error);
    return res.status(500).json({ message: "Error applying leave", error });
  }
};

export const getMyLeaves = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const leaveRepo = AppDataSource.getRepository(Leave);
    const leaves = await leaveRepo.find({ where: { user: { id: user.id } } });
    return res.json(leaves);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leaves", error });
  }
};

export const getAllLeaves = async (_req: Request, res: Response) => {
  try {
    const leaveRepo = AppDataSource.getRepository(Leave);
    const leaves = await leaveRepo.find({ relations: ["user"] });
    return res.json(leaves);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leaves", error });
  }
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, managerComment } = req.body;
    const statusValue = status as LeaveStatus;

    if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED].includes(statusValue)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leaveRepo = AppDataSource.getRepository(Leave);
    const leave = await leaveRepo.findOne({
      where: { id: parseInt(id, 10) },
      relations: ["user"],
    });

    if (!leave) return res.status(404).json({ message: "Leave not found" });

    leave.status = statusValue;
    leave.managerComment = managerComment;
    await leaveRepo.save(leave);

    return res.json({ message: `Leave ${statusValue.toLowerCase()} successfully`, leave });
  } catch (error) {
    return res.status(500).json({ message: "Error updating leave status", error });
  }
};

export async function getCalendarEvents(req: Request, res: Response) {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);
    const { status, role } = req.query;
    let query = leaveRepository.createQueryBuilder("leave").leftJoinAndSelect("leave.user", "user");

    if (status) {
      query = query.andWhere("leave.status = :status", { status });
    }
    if (role) {
      query = query.andWhere("user.role = :role", { role });
    }

    const leaves = await query.getMany();
    const events = mapLeavesToCalendarEvents(leaves);
    return res.json(events);
  } catch (error) {
    console.error("getCalendarEvents error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
