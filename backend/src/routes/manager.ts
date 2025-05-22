import { Router } from "express";
import {
  createLeaveRequestByManager,
  getTeamLeaveRequests,
  approveOrRejectLeaveByManager,
  getTeamAttendance,
  getLateComers,
  getOwnProfileManager,
  updateOwnProfileManager,
} from "../controllers/managerController";

const router = Router();

// Create a leave request (Manager)
router.post("/leave", createLeaveRequestByManager);

// Get leave requests from team members
router.get("/:id/team-leaves", getTeamLeaveRequests);

// For example, in your routes file (managerRoutes.ts or wherever):
router.patch(
  "/manager/:managerId/leave/:id/approve",
  approveOrRejectLeaveByManager
);

// Get attendance status of team members
router.get("/:id/team-attendance", getTeamAttendance);

// Get late comers from team
router.get("/:id/latecomers", getLateComers);

// Get own manager profile
router.get("/:id/profile", getOwnProfileManager);

// Update own manager profile
router.put("/:id/profile", updateOwnProfileManager);

export default router;
