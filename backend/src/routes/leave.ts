import { Router } from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
} from "../controllers/LeaveController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const router = Router();

router.post("/apply", authMiddleware, applyLeave);
router.get("/my", authMiddleware, getMyLeaves);

// Manager/Admin routes
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["Manager", "Admin"]),
  getAllLeaves
);
router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["Manager", "Admin"]),
  updateLeaveStatus
);

export default router;
