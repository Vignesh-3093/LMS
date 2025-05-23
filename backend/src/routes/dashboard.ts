import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authMiddleware } from '../middlewares/authMiddleware';


const router = Router();

router.get('/team-stats', authMiddleware, DashboardController.getTeamLeaveStats);
router.get('/monthly-trends', authMiddleware, DashboardController.getMonthlyTrends);

export default router;
