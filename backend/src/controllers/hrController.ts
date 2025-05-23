import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../entities/User";
import { Leave, LeaveStatus } from "../entities/Leaves";
import bcrypt from "bcrypt";
import { In } from "typeorm";
import { UserRole } from "../entities/User";

// 1. HR creates leave request - always pending Admin approval
export const createLeaveRequestByHR = async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, reason } = req.body;

    if (!userId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userRepository = AppDataSource.getRepository(User);
    const leaveRepository = AppDataSource.getRepository(Leave);

    const hrUser = await userRepository.findOneBy({
      id: userId,
      role: UserRole.HR,
    });
    if (!hrUser) {
      return res
        .status(403)
        .json({ message: "Only HR can create this leave request" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const status = LeaveStatus.PENDING_ADMIN_APPROVAL;

    const leave = leaveRepository.create({
      user: hrUser,
      startDate: start,
      endDate: end,
      reason,
      status,
    });

    await leaveRepository.save(leave);
    res.status(201).json({
      message: "Leave request created and pending Admin approval",
      leave,
    });
  } catch (error) {
    console.error("createLeaveRequestByHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 2. HR can view leave requests of Employees and Managers only (exclude Admin and HR leaves)
export const getLeavesForHR = async (req: Request, res: Response) => {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);

    const leaves = await leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.user", "user")
      .where("user.role IN (:...roles)", {
        roles: [UserRole.USER, UserRole.MANAGER], // exclude HR and Admin
      })
      .getMany();

    res.json(leaves);
  } catch (error) {
    console.error("getLeavesForHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 3. HR fetch leave requests awaiting their approval (only USER and MANAGER, no HR leaves)
export const getLeavesAwaitingHRApproval = async (
  req: Request,
  res: Response
) => {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);

    const leaves = await leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.user", "user")
      .where("leave.status = :status", {
        status: LeaveStatus.PENDING_HR_APPROVAL,
      })
      .andWhere("user.role IN (:...roles)", {
        roles: [UserRole.USER, UserRole.MANAGER],
      })
      .getMany();

    res.json(leaves);
  } catch (error) {
    console.error("getLeavesAwaitingHRApproval error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 4. HR can approve/reject leave requests pending their approval but NOT HR leave requests
export const approveOrRejectLeaveByHR = async (req: Request, res: Response) => {
  try {
    const leaveId = Number(req.params.id);
    const { status, hrComment } = req.body;
    if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leaveRepository = AppDataSource.getRepository(Leave);
    const leave = await leaveRepository.findOne({
      where: { id: leaveId },
      relations: ["user"],
    });

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    if (
      leave.status !== LeaveStatus.PENDING_HR_APPROVAL ||
      ![UserRole.USER, UserRole.MANAGER].includes(leave.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this leave" });
    }

    leave.status = status;
    leave.hrComment = hrComment;
    await leaveRepository.save(leave);

    res.json({ message: `Leave ${status.toLowerCase()} by HR`, leave });
  } catch (error) {
    console.error("approveOrRejectLeaveByHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 5. HR sees daily attendance of all staff including other HRs (exclude Admin)
export const getDailyAttendanceForHR = async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const leaveRepository = AppDataSource.getRepository(Leave);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await userRepository.find({
      where: { role: In([UserRole.USER, UserRole.MANAGER, UserRole.HR]) }, // Include HR but exclude Admin
    });

    const leavesToday = await leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.user", "user")
      .where("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere(":today BETWEEN leave.startDate AND leave.endDate", { today })
      .andWhere("user.role IN (:...roles)", {
        roles: [UserRole.USER, UserRole.MANAGER, UserRole.HR],
      })
      .getMany();

    const absentUserIds = new Set(leavesToday.map((leave) => leave.user.id));

    const attendance = users.map((user) => ({
      userId: user.id,
      name: user.name,
      role: user.role,
      status: absentUserIds.has(user.id) ? "Absent" : "Present",
    }));

    res.json(attendance);
  } catch (error) {
    console.error("getDailyAttendanceForHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 6. HR can view leave summaries excluding Admin data
export const getLeaveAnalyticsForHR = async (req: Request, res: Response) => {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);

    const leaves = await leaveRepository.find({ relations: ["user"] });

    const summary: Record<string, number> = {
      [UserRole.HR]: 0,
      [UserRole.MANAGER]: 0,
      [UserRole.USER]: 0,
    };

    leaves.forEach((leave) => {
      if (leave.status !== LeaveStatus.APPROVED) return;
      if (!leave.startDate || !leave.endDate) return;

      const days = Math.ceil(
        (leave.endDate.getTime() - leave.startDate.getTime()) /
          (1000 * 3600 * 24) +
          1
      );

      const role = leave.user.role;
      if (role !== UserRole.ADMIN && summary[role] !== undefined) {
        summary[role] += days;
      }
    });

    res.json(summary);
  } catch (error) {
    console.error("getLeaveAnalyticsForHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 7. HR can view own profile
export const getOwnProfileHR = async (req: Request, res: Response) => {
  try {
    const hrId = Number(req.params.id);
    const userRepository = AppDataSource.getRepository(User);

    const hrUser = await userRepository.findOneBy({
      id: hrId,
      role: UserRole.HR,
    });
    if (!hrUser) {
      return res.status(404).json({ message: "HR user not found" });
    }

    res.json({
      id: hrUser.id,
      name: hrUser.name,
      email: hrUser.email,
      role: hrUser.role,
      leaveBalancePaid: hrUser.leaveBalancePaid,
      leaveBalanceSick: hrUser.leaveBalanceSick,
    });
  } catch (error) {
    console.error("getOwnProfileHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 8. HR can update own profile
export const updateOwnProfileHR = async (req: Request, res: Response) => {
  try {
    const hrId = Number(req.params.id);
    const { name, password, leaveBalancePaid, leaveBalanceSick } = req.body;

    const userRepository = AppDataSource.getRepository(User);
    const hrUser = await userRepository.findOneBy({
      id: hrId,
      role: UserRole.HR,
    });

    if (!hrUser) {
      return res.status(404).json({ message: "HR user not found" });
    }

    if (name) hrUser.name = name;
    if (leaveBalancePaid !== undefined)
      hrUser.leaveBalancePaid = leaveBalancePaid;
    if (leaveBalanceSick !== undefined)
      hrUser.leaveBalanceSick = leaveBalanceSick;

    if (password) {
      hrUser.password = await bcrypt.hash(password, 10);
    }

    await userRepository.save(hrUser);

    res.json({ message: "Profile updated successfully", hrUser });
  } catch (error) {
    console.error("updateOwnProfileHR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
