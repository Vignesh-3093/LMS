import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Leave, LeaveStatus } from "../entities/Leaves";
import { shouldRequireAdminApproval } from "../services/LeaveServices";
import { MoreThanOrEqual, LessThanOrEqual } from "typeorm";

export class EmployeeController {
  async submitLeaveRequest(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { startDate, endDate, type } = req.body;

      if (!startDate || !endDate || !type) {
        return res.status(400).json({ message: "startDate, endDate and type are required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({ message: "Start date cannot be after end date" });
      }

      const duration = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1
      );

      const leaveRepository = AppDataSource.getRepository(Leave);

      const totalLeavesInMonth = await leaveRepository.count({
        where: {
          user: { id: user.id },
          startDate: MoreThanOrEqual(start),
          endDate: LessThanOrEqual(end),
          status: LeaveStatus.APPROVED,
        },
      });

      const adminApprovalRequired = shouldRequireAdminApproval(user.role, duration, totalLeavesInMonth);

      const newLeave = leaveRepository.create({
        user,
        startDate: start,
        endDate: end,
        type,
        duration,
        status: adminApprovalRequired ? LeaveStatus.PENDING_ADMIN_APPROVAL : LeaveStatus.PENDING,
      });

      await leaveRepository.save(newLeave);

      return res.status(201).json(newLeave);
    } catch (error) {
      console.error("submitLeaveRequest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getOwnLeaves(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const leaveRepository = AppDataSource.getRepository(Leave);
      const leaves = await leaveRepository.find({ where: { user: { id: user.id } } });

      return res.json(leaves);
    } catch (error) {
      console.error("getOwnLeaves error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async editLeaveRequest(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const leaveId = Number(req.params.id);
      if (isNaN(leaveId)) {
        return res.status(400).json({ message: "Invalid leave id" });
      }

      const { startDate, endDate, type } = req.body;
      if (!startDate || !endDate || !type) {
        return res.status(400).json({ message: "startDate, endDate and type are required" });
      }

      const leaveRepository = AppDataSource.getRepository(Leave);
      const leave = await leaveRepository.findOne({ where: { id: leaveId }, relations: ["user"] });

      if (!leave) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      if (leave.user.id !== user.id) {
        return res.status(403).json({ message: "Forbidden: Cannot edit others' leave" });
      }

      if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) {
        return res.status(400).json({ message: "Cannot edit approved or rejected leave" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({ message: "Start date cannot be after end date" });
      }

      leave.startDate = start;
      leave.endDate = end;
      leave.type = type;

      const duration = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1
      );
      leave.duration = duration;

      const totalLeavesInMonth = await leaveRepository.count({
        where: {
          user: { id: user.id },
          startDate: MoreThanOrEqual(start),
          endDate: LessThanOrEqual(end),
          status: LeaveStatus.APPROVED,
        },
      });

      leave.status = shouldRequireAdminApproval(user.role, duration, totalLeavesInMonth)
        ? LeaveStatus.PENDING_ADMIN_APPROVAL
        : LeaveStatus.PENDING;

      await leaveRepository.save(leave);

      return res.json(leave);
    } catch (error) {
      console.error("editLeaveRequest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async cancelLeaveRequest(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const leaveId = Number(req.params.id);
      if (isNaN(leaveId)) {
        return res.status(400).json({ message: "Invalid leave id" });
      }

      const leaveRepository = AppDataSource.getRepository(Leave);
      const leave = await leaveRepository.findOne({ where: { id: leaveId }, relations: ["user"] });

      if (!leave) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      if (leave.user.id !== user.id) {
        return res.status(403).json({ message: "Forbidden: Cannot cancel others' leave" });
      }

      if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) {
        return res.status(400).json({ message: "Cannot cancel approved or rejected leave" });
      }

      await leaveRepository.remove(leave);

      return res.json({ message: "Leave request canceled successfully" });
    } catch (error) {
      console.error("cancelLeaveRequest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getLeaveHistory(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const leaveRepository = AppDataSource.getRepository(Leave);
      const leaves = await leaveRepository.find({ where: { user: { id: user.id } } });
      return res.json(leaves);
    } catch (error) {
      console.error("getLeaveHistory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async checkTodayLeaveStatus(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const leaveRepository = AppDataSource.getRepository(Leave);
      const leave = await leaveRepository.findOne({
        where: {
          user: { id: user.id },
          startDate: LessThanOrEqual(today),
          endDate: MoreThanOrEqual(today),
          status: LeaveStatus.APPROVED,
        },
      });

      return res.json({ onLeaveToday: !!leave });
    } catch (error) {
      console.error("checkTodayLeaveStatus error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getLeaveBalance(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // TODO: implement actual leave balance logic here
      return res.json({ balance: 10 }); // Placeholder value
    } catch (error) {
      console.error("getLeaveBalance error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}
