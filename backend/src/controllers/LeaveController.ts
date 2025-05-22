import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Leave, LeaveStatus } from "../entities/Leave";
import { User } from "../entities/User";

// Apply for leave
export const applyLeave = async (req: Request, res: Response) => {
  try {
    // req.user has partial info, fetch full User entity from DB
    const partialUser = req.user!;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: partialUser.id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { startDate, endDate, type, reason } = req.body;

    const leaveRepo = AppDataSource.getRepository(Leave);

    const leave = leaveRepo.create({
      startDate,
      endDate,
      type,
      reason,
      user, // assign full User entity here
      status: LeaveStatus.PENDING,
    });

    await leaveRepo.save(leave);
    return res
      .status(201)
      .json({ message: "Leave applied successfully", leave });
  } catch (error) {
    return res.status(500).json({ message: "Error applying leave", error });
  }
};

// Get leaves of logged-in user
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

// Get all leaves (for manager/admin)
export const getAllLeaves = async (_req: Request, res: Response) => {
  try {
    const leaveRepo = AppDataSource.getRepository(Leave);
    const leaves = await leaveRepo.find({ relations: ["user"] });
    return res.json(leaves);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leaves", error });
  }
};

// Approve or reject leave by manager/admin
export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, managerComment } = req.body;

    // Cast incoming status string to LeaveStatus enum type
    const statusValue = status as LeaveStatus;

    // Validate that status is either APPROVED or REJECTED
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

    return res.json({
      message: `Leave ${statusValue.toLowerCase()} successfully`,
      leave,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating leave status", error });
  }
};
