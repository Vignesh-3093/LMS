import { Router } from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
  getCalendarEvents,
} from "../controllers/LeaveController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import { UserRole } from "../entities/User";

const router = Router();

// Protect all routes with auth
router.use(authMiddleware);

// Employee routes
router.post("/apply", applyLeave);
router.get("/my", getMyLeaves);
router.get("/calendar", getCalendarEvents);

// Manager/Admin routes
router.get("/", roleMiddleware([UserRole.MANAGER, UserRole.ADMIN]), getAllLeaves);
router.put("/:id/status", roleMiddleware([UserRole.MANAGER, UserRole.ADMIN]), updateLeaveStatus);

export default router;
