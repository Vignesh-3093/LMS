import express from "express";
import {
  createUserByAdmin,
  updateUserRole,
  getAllStaffLeavesSummary,
  getDailyAttendance,
  approveLeaveByAdmin,
  assignEmployeeToManager,
  getAllUsers,
  getHrLeaveRequestsForAdmin,
} from "../controllers/AdminController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import { UserRole } from "../entities/User";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware([UserRole.ADMIN]));

router.post("/users", createUserByAdmin);
router.patch("/users/:id/role", updateUserRole);
router.get("/leaves/summary", getAllStaffLeavesSummary);
router.get("/attendance/daily", getDailyAttendance);
router.patch("/leaves/:id/approve", approveLeaveByAdmin);
router.post("/assign-employee", assignEmployeeToManager);
router.get("/users", getAllUsers);
router.get("/leaves/hr", getHrLeaveRequestsForAdmin);

export default router;
