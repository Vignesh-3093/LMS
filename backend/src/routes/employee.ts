import { Router } from "express";
import { EmployeeController } from "../controllers/EmployeeController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const controller = new EmployeeController();

router.use(authMiddleware);

router.post("/leave", controller.submitLeaveRequest.bind(controller));
router.get("/leave", controller.getOwnLeaves.bind(controller));
router.put("/leave/:id", controller.editLeaveRequest.bind(controller));
router.delete("/leave/:id", controller.cancelLeaveRequest.bind(controller));
router.get("/leave/history", controller.getLeaveHistory.bind(controller));
router.get("/leave/status/today", controller.checkTodayLeaveStatus.bind(controller));
router.get("/leave/balance", controller.getLeaveBalance.bind(controller));

export default router;
