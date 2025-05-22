import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User, UserRole } from "../entities/User";
import { Leave, LeaveStatus } from "../entities/Leave";
import bcrypt from "bcrypt";

const ADMIN_APPROVAL_THRESHOLD = 5; // days threshold for Admin approval of Manager/User leaves

// 1. Create user (HR, Manager, Employee) by Admin
export const createUserByAdmin = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      name,
      role,
      leaveBalancePaid,
      leaveBalanceSick,
      managerId,
    } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (![UserRole.USER, UserRole.MANAGER, UserRole.HR].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const userRepository = AppDataSource.getRepository(User);

    // Check email unique
    const existingUser = await userRepository.findOneBy({ email });
    if (existingUser)
      return res.status(409).json({ message: "Email already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user entity
    const userData: Partial<User> = {
      email,
      password: hashedPassword,
      name,
      role: role as UserRole,
      leaveBalancePaid: leaveBalancePaid ?? 12,
      leaveBalanceSick: leaveBalanceSick ?? 8,
    };

    // Assign manager if provided and role is employee
    if (role === UserRole.USER && managerId) {
      const manager = await userRepository.findOneBy({
        id: managerId,
        role: UserRole.MANAGER,
      });
      if (!manager) {
        return res.status(400).json({ message: "Invalid managerId" });
      }
      userData.manager = manager;
    }

    const user = userRepository.create(userData);
    await userRepository.save(user);

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("createUserByAdmin error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 2. Update User Role (Admin can change roles)
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (
      ![UserRole.USER, UserRole.MANAGER, UserRole.HR, UserRole.ADMIN].includes(
        role
      )
    ) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent changing Admin's own role
    if (user.role === UserRole.ADMIN) {
      return res
        .status(403)
        .json({ message: "Cannot change role of Admin user" });
    }

    user.role = role as UserRole;
    await userRepository.save(user);

    return res.json({ message: "User role updated successfully", user });
  } catch (error) {
    console.error("updateUserRole error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 3. Get Summary of Leave taken by all staff (HR, Manager, Employee)
export const getAllStaffLeavesSummary = async (req: Request, res: Response) => {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);
    const userRepository = AppDataSource.getRepository(User);

    // Group leave days by role
    const users = await userRepository.find();
    const leaves = await leaveRepository.find({ relations: ["user"] });

    // Calculate total leave days per role
    const summary: Record<string, number> = {
      [UserRole.ADMIN]: 0,
      [UserRole.HR]: 0,
      [UserRole.MANAGER]: 0,
      [UserRole.USER]: 0,
    };

    leaves.forEach((leave) => {
      if (leave.status !== LeaveStatus.APPROVED) return;
      if (!leave.startDate || !leave.endDate) return; // SAFETY CHECK

      const days = Math.ceil(
        (leave.endDate.getTime() - leave.startDate.getTime()) /
          (1000 * 3600 * 24) +
          1
      );
      const role = leave.user.role;
      if (summary[role] !== undefined) {
        summary[role] += days;
      }
    });

    res.json(summary);
  } catch (error) {
    console.error("getAllStaffLeavesSummary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 4. Get Present/Absent status of all staff today
export const getDailyAttendance = async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const leaveRepository = AppDataSource.getRepository(Leave);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await userRepository.find();

    // Find leaves that cover today and are approved
    const leavesToday = await leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.user", "user")
      .where("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere(":today BETWEEN leave.startDate AND leave.endDate", { today })
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
    console.error("getDailyAttendance error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 5. Approve Leave Requests - Admin approves HR always, and Manager/User if leave days > threshold
export const approveLeaveByAdmin = async (req: Request, res: Response) => {
  try {
    const leaveId = Number(req.params.id);
    const { status, managerComment } = req.body; // status should be APPROVED or REJECTED

    if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leaveRepository = AppDataSource.getRepository(Leave);
    const leave = await leaveRepository.findOne({
      where: { id: leaveId },
      relations: ["user"],
    });

    if (!leave)
      return res.status(404).json({ message: "Leave request not found" });

    if (!leave.startDate || !leave.endDate) {
      return res.status(400).json({ message: "Leave dates not properly set" });
    }

    // Only admin can approve HR leaves or Manager/User leaves > threshold days
    const leaveDays = Math.ceil(
      (leave.endDate.getTime() - leave.startDate.getTime()) /
        (1000 * 3600 * 24) +
        1
    );

    if (leave.user.role === UserRole.HR) {
      // Only Admin can approve HR leaves
      leave.status = status;
    } else if ([UserRole.MANAGER, UserRole.USER].includes(leave.user.role)) {
      // Admin approves Manager/User leaves if days > threshold
      if (leaveDays > ADMIN_APPROVAL_THRESHOLD) {
        leave.status = status;
      } else {
        return res.status(403).json({
          message:
            "Leave approval below threshold should be handled by Manager",
        });
      }
    } else {
      return res
        .status(403)
        .json({ message: "Only Admin can approve this leave" });
    }

    leave.managerComment = managerComment;
    await leaveRepository.save(leave);

    return res.json({ message: "Leave status updated by Admin", leave });
  } catch (error) {
    console.error("approveLeaveByAdmin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 6. Assign Employee to Manager
export const assignEmployeeToManager = async (req: Request, res: Response) => {
  try {
    const { employeeId, managerId } = req.body;
    const userRepository = AppDataSource.getRepository(User);

    // Validate both users exist and roles
    const employee = await userRepository.findOneBy({
      id: employeeId,
      role: UserRole.USER,
    });
    const manager = await userRepository.findOneBy({
      id: managerId,
      role: UserRole.MANAGER,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    employee.manager = manager;
    await userRepository.save(employee);

    return res.json({ message: "Employee assigned to Manager", employee });
  } catch (error) {
    console.error("assignEmployeeToManager error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 7. Get all users (simple list)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({
      relations: ["manager", "employees"], // optional, if you want relationships
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 8.Get all HR leave requests (Admin only)
export const getHrLeaveRequestsForAdmin = async (
  req: Request,
  res: Response
) => {
  try {
    const leaveRepository = AppDataSource.getRepository(Leave);

    // Fetch all HR leave requests regardless of status
    const hrLeaves = await leaveRepository.find({
      where: {
        user: { role: UserRole.HR },
      },
      relations: ["user"],
    });

    res.json(hrLeaves);
  } catch (error) {
    console.error("getHrLeaveRequestsForAdmin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
