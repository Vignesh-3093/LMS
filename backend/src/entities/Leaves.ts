import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

export enum LeaveStatus {
  PENDING = "Pending",
  PENDING_ADMIN_APPROVAL = "PENDING_ADMIN_APPROVAL",
  PENDING_HR_APPROVAL = "PENDING_HR_APPROVAL",
  PENDING_HR_ADMIN_APPROVAL = "PENDING_HR_ADMIN_APPROVAL",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

export enum LeaveType {
  SICK = "Sick",
  CASUAL = "Casual",
  EARNED = "Earned",
}

export enum ApproverRole {
  ADMIN = "ADMIN",
  HR = "HR",
  MANAGER = "MANAGER",
  NONE = "NONE",
}

interface ApprovalStatus {
  level1?: string;
  level2?: string;
  final?: string;
}

@Entity("leaves")
export class Leave {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.leaves, { onDelete: "CASCADE" })
  user!: User;

  @Column({ type: "enum", enum: LeaveType })
  type!: LeaveType;

  @Column({ type: "timestamp", nullable: true })  // or "datetime" for MySQL
  startDate?: Date;

  @Column({ type: "timestamp", nullable: true })  // or "datetime" for MySQL
  endDate?: Date;

  @Column({ nullable: true })
  reason?: string;

  @Column({ type: "enum", enum: LeaveStatus, default: LeaveStatus.PENDING })
  status!: LeaveStatus;

  @Column({ nullable: true })
  managerComment?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  hrComment?: string;

  @Column({ type: "enum", enum: ApproverRole, default: ApproverRole.NONE })
  nextApprover!: ApproverRole;

  @Column({ type: "json", nullable: true })
  approvalStatus!: ApprovalStatus;

  @Column({ type: 'int', nullable: true })
duration?: number;

}
