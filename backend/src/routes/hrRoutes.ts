import { Router } from "express";
import {
  createLeaveRequestByHR,
  getLeavesForHR,
  getLeavesAwaitingHRApproval,
  approveOrRejectLeaveByHR,
  getDailyAttendanceForHR,
  getLeaveAnalyticsForHR,
  getOwnProfileHR,
  updateOwnProfileHR,
} from "../controllers/hrController";

const router = Router();

router.post("/leave/request", createLeaveRequestByHR);

router.get("/leaves", getLeavesForHR);

router.get("/leaves/pending", getLeavesAwaitingHRApproval);

router.patch("/leave/:id/decision", approveOrRejectLeaveByHR);

router.get("/attendance/today", getDailyAttendanceForHR);

router.get("/analytics/leaves", getLeaveAnalyticsForHR);

router.get("/profile/:id", getOwnProfileHR);

router.put("/profile/:id", updateOwnProfileHR);

export default router;
