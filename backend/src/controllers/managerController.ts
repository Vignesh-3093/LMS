import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User, UserRole } from "../entities/User";
import { Leave, LeaveStatus } from "../entities/Leaves";
import bcrypt from "bcrypt";
import { In } from "typeorm";
import { Between } from "typeorm";

// Helper: Get team members of a manager
const getTeamMembers = async (managerId: number) => {
  const userRepository = AppDataSource.getRepository(User);
  return await userRepository.find({ where: { manager: { id: managerId } } });
};

// --- Notification Stub (Replace with real email/push integration) ---
const sendNotification = async (
  userId: number,
  message: string
): Promise<void> => {
  console.log(`Notify user ${userId}: ${message}`);
};

// --- Pagination helper ---
const getPagination = (page: number, size: number) => {
  const limit = size ? +size : 10;
  const offset = page ? (page - 1) * limit : 0;
  return { limit, offset };
};

// --- 1. Manager creates leave request ---
export const createLeaveRequestByManager = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, startDate, endDate, reason } = req.body;
    if (!userId || !startDate || !endDate || !reason)
      return res.status(400).json({ message: "Missing fields" });

    const userRepository = AppDataSource.getRepository(User);
    const leaveRepository = AppDataSource.getRepository(Leave);
    const manager = await userRepository.findOneBy({
      id: userId,
      role: UserRole.MANAGER,
    });
    if (!manager)
      return res
        .status(403)
        .json({ message: "Only Manager can create this leave request" });

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end)
      return res
        .status(400)
        .json({ message: "startDate cannot be after endDate" });

    const leaveDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1
    );

    const status =
      leaveDays >= 5
        ? LeaveStatus.PENDING_HR_ADMIN_APPROVAL
        : LeaveStatus.PENDING_HR_APPROVAL;

    const leave = leaveRepository.create({
      user: manager,
      startDate: start,
      endDate: end,
      reason,
      status,
    });
    await leaveRepository.save(leave);

    // Notify HR/Admin or HR depending on status
    await sendNotification(
      status === LeaveStatus.PENDING_HR_ADMIN_APPROVAL ? -1 : -2,
      `New leave request from Manager ${manager.name}`
    );

    res.status(201).json({ message: "Leave request submitted", leave });
  } catch (error) {
    console.error("createLeaveRequestByManager error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 2. View leave requests from team members with pagination and optional filtering ---
export const getTeamLeaveRequests = async (req: Request, res: Response) => {
  try {
    const managerId = Number(req.params.id);
    const page = Number(req.query.page) || 1;
    const size = Number(req.query.size) || 10;
    const statusFilter = req.query.status as LeaveStatus | undefined;

    const team = await getTeamMembers(managerId);
    const teamIds = team.map((u) => u.id);

    const leaveRepository = AppDataSource.getRepository(Leave);

    const whereClause: any = { user: { id: In(teamIds) } };
    if (statusFilter) whereClause.status = statusFilter;

    const [leaves, total] = await leaveRepository.findAndCount({
      where: whereClause,
      relations: ["user"],
      order: { startDate: "DESC" },
      skip: (page - 1) * size,
      take: size,
    });

    res.json({
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
      leaves,
    });
  } catch (error) {
    console.error("getTeamLeaveRequests error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 3. Approve/reject leave requests from team with audit logs and notifications ---
export const approveOrRejectLeaveByManager = async (
  req: Request,
  res: Response
) => {
  try {
    const leaveId = Number(req.params.id);
    const managerId = Number(req.params.managerId);

    const { status, managerComment } = req.body;

    if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leaveRepository = AppDataSource.getRepository(Leave);
    const userRepository = AppDataSource.getRepository(User);

    const leave = await leaveRepository.findOne({
      where: { id: leaveId },
      relations: ["user"],
    });
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    const team = await getTeamMembers(managerId);
    const teamIds = team.map((u) => u.id);
    if (!teamIds.includes(leave.user.id)) {
      return res
        .status(403)
        .json({ message: "Leave request not in your team" });
    }

    if (leave.user.role !== UserRole.USER) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this leave" });
    }

    // Update leave status, comment & audit logs on user entity
    leave.status = status;
    leave.managerComment = managerComment;
    leave.updatedAt = new Date();
    await leaveRepository.save(leave);

    // Audit logs: update manager's last approved/rejected timestamp
    const manager = await userRepository.findOneBy({ id: managerId });
    if (manager) {
      if (status === LeaveStatus.APPROVED) {
        manager.lastLeaveApprovedAt = new Date();
      } else if (status === LeaveStatus.REJECTED) {
        manager.lastLeaveRejectedAt = new Date();
      }
      await userRepository.save(manager);
    }

    // Notify the user about the leave decision
    await sendNotification(
      leave.user.id,
      `Your leave request has been ${status.toLowerCase()} by your Manager.`
    );

    res.json({ message: `Leave ${status.toLowerCase()} by Manager`, leave });
  } catch (error) {
    console.error("approveOrRejectLeaveByManager error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 4. View attendance of team with pagination and filtering by date ---
export const getTeamAttendance = async (req: Request, res: Response) => {
  try {
    const managerId = Number(req.params.id);
    const dateQuery = req.query.date as string;
    const page = Number(req.query.page) || 1;
    const size = Number(req.query.size) || 10;

    const team = await getTeamMembers(managerId);
    const teamIds = team.map((u) => u.id);

    const date = dateQuery ? new Date(dateQuery) : new Date();
    date.setHours(0, 0, 0, 0);

    const leaveRepository = AppDataSource.getRepository(Leave);
    const leavesToday = await leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.user", "user")
      .where("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere(":date BETWEEN leave.startDate AND leave.endDate", { date })
      .andWhere("user.id IN (:...teamIds)", { teamIds })
      .getMany();

    const absentUserIds = new Set(leavesToday.map((l) => l.user.id));

    // Paginate attendance array manually
    const attendanceFull = team.map((user) => ({
      userId: user.id,
      name: user.name,
      status: absentUserIds.has(user.id) ? "Absent" : "Present",
    }));

    const startIndex = (page - 1) * size;
    const paginatedAttendance = attendanceFull.slice(
      startIndex,
      startIndex + size
    );

    res.json({
      total: attendanceFull.length,
      page,
      size,
      totalPages: Math.ceil(attendanceFull.length / size),
      attendance: paginatedAttendance,
    });
  } catch (error) {
    console.error("getTeamAttendance error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 5. View latecomers of team ---
export const getLateComers = async (req: Request, res: Response) => {
  try {
    const managerId = Number(req.params.managerId);
    const team = await getTeamMembers(managerId);

    const lateComers = team.filter((u) => {
      if (!u.lastLogin) return false;
      const loginHour = new Date(u.lastLogin).getHours();
      return loginHour >= 10;
    });

    res.json(
      lateComers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        lastLogin: u.lastLogin,
      }))
    );
  } catch (error) {
    console.error("getLateComers error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 6. View own profile ---
export const getOwnProfileManager = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userRepository = AppDataSource.getRepository(User);
    const manager = await userRepository.findOneBy({
      id,
      role: UserRole.MANAGER,
    });

    if (!manager) return res.status(404).json({ message: "Manager not found" });

    res.json({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role,
      leaveBalancePaid: manager.leaveBalancePaid,
      leaveBalanceSick: manager.leaveBalanceSick,
    });
  } catch (error) {
    console.error("getOwnProfileManager error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 7. Update own profile ---
export const updateOwnProfileManager = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password } = req.body;

    if (!name && !email && !password)
      return res.status(400).json({ message: "At least one field required" });

    const userRepository = AppDataSource.getRepository(User);
    const manager = await userRepository.findOneBy({
      id,
      role: UserRole.MANAGER,
    });
    if (!manager) return res.status(404).json({ message: "Manager not found" });

    if (name) manager.name = name;
    if (email) manager.email = email;
    if (password) {
      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }
      const saltRounds = 10;
      manager.password = await bcrypt.hash(password, saltRounds);
    }

    await userRepository.save(manager);

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("updateOwnProfileManager error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- 8. Dashboard stats summary ---
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const managerId = Number(req.params.id);
    const team = await getTeamMembers(managerId);
    const teamIds = team.map((u) => u.id);

    const leaveRepository = AppDataSource.getRepository(Leave);

    // Total leaves pending approval by Manager (status PENDING_USER_APPROVAL)
    const totalLeavesPending = await leaveRepository.count({
      where: {
        user: { id: In(teamIds) },
        status: LeaveStatus.PENDING_HR_APPROVAL,
      },
    });

    // Upcoming leaves (starting in next 7 days)
    const now = new Date();
    const upcomingLeaves = await leaveRepository.count({
      where: {
        user: { id: In(teamIds) },
        startDate: Between(
          now,
          new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        ),
        status: LeaveStatus.APPROVED,
      },
    });

    // Latecomer count (lastLogin after 10am today)
    const lateComers = team.filter((u) => {
      if (!u.lastLogin) return false;
      const loginDate = new Date(u.lastLogin);
      const isToday = loginDate.toDateString() === new Date().toDateString();
      const loginHour = loginDate.getHours();
      return isToday && loginHour >= 10;
    });

    res.json({
      totalLeavesPending,
      upcomingLeaves,
      latecomerCount: lateComers.length,
    });
  } catch (error) {
    console.error("getDashboardStats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
