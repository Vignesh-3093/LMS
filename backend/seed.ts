import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { User, UserRole } from "./src/entities/User";
import { Leave, LeaveType, LeaveStatus } from "./src/entities/Leaves";
import bcrypt from "bcrypt";

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log("Data Source initialized");

    const userRepository = AppDataSource.getRepository(User);
    const leaveRepository = AppDataSource.getRepository(Leave);

    // Disable foreign key checks to allow truncation
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 0;");
    // Clear existing data
    await leaveRepository.clear();
    await userRepository.clear();
    // Re-enable foreign key checks
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 1;");

    // Create users data
    const usersData: Omit<User, "id" | "leaves">[] = [
      {
        email: "admin@example.com",
        password: "adminpass",
        name: "Admin User",
        role: "Admin" as UserRole,
        leaveBalancePaid: 20,
        leaveBalanceSick: 15,
        createdAt: new Date(),
    updatedAt: new Date(),
      },
      {
        email: "manager@example.com",
        password: "managerpass",
        name: "Manager User",
        role: "Manager" as UserRole,
        leaveBalancePaid: 15,
        leaveBalanceSick: 10,
        createdAt: new Date(),
    updatedAt: new Date(),
      },
      {
        email: "hr@example.com",
        password: "hrpass",
        name: "HR User",
        role: "HR" as UserRole,
        leaveBalancePaid: 18,
        leaveBalanceSick: 12,
        createdAt: new Date(),
    updatedAt: new Date(),
      },
      {
  email: "employee@example.com",
  password: "employeepass",
  name: "Employee User",
  role: UserRole.EMPLOYEE,  // <-- fix here, use UserRole enum properly
  leaveBalancePaid: 12,
  leaveBalanceSick: 8,
  createdAt: new Date(),
  updatedAt: new Date(),
}

    ];

    // Hash passwords and save users
    const users: User[] = [];
    for (const userData of usersData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = userRepository.create({
        ...userData,
        password: hashedPassword,
      });
      users.push(await userRepository.save(user));
    }

    console.log("Users seeded");

    // Use saved user entities for leavesData
    const employeeUser = users.find((u) => u.role === UserRole.EMPLOYEE);
    if (!employeeUser) throw new Error("Employee user not found");

    // Create leave requests with correct user entity
    const leavesData = [
      {
        user: employeeUser,
        type: LeaveType.SICK,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-03"),
        reason: "Feeling sick",
        status: LeaveStatus.PENDING,
      },
      {
        user: employeeUser,
        type: LeaveType.CASUAL,
        startDate: new Date("2025-06-10"),
        endDate: new Date("2025-06-12"),
        reason: "Family function",
        status: LeaveStatus.APPROVED,
        managerComment: "Enjoy your leave",
      },
      {
        user: employeeUser,
        type: LeaveType.EARNED,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-05"),
        reason: "Vacation",
        status: LeaveStatus.REJECTED,
        managerComment: "Insufficient leave balance",
      },
    ];

    for (const leaveData of leavesData) {
      const leave = leaveRepository.create(leaveData);
      await leaveRepository.save(leave);
    }

    console.log("Leaves seeded");

    await AppDataSource.destroy();
    console.log("Seeding complete and connection closed");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
