import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.get("/me", authMiddleware, (req, res) => {
  return res.json(req.user);
});

export default router;
