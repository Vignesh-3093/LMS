import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Leave } from "./Leave";

export enum UserRole {
  USER = "USER",
  MANAGER = "MANAGER",
  HR = "HR",
  ADMIN = "ADMIN",
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ nullable: true })
  lastLogin?: Date;

  @Column({ type: "int", default: 0 })
  leaveBalancePaid!: number;

  @Column({ type: "int", default: 0 })
  leaveBalanceSick!: number;

  // Audit fields for leave approvals (optional, just for manager entity)
  @Column({ nullable: true })
  lastLeaveApprovedAt?: Date;

  @Column({ nullable: true })
  lastLeaveRejectedAt?: Date;

  @OneToMany(() => Leave, (leave) => leave.user)
  leaves!: Leave[];

  @ManyToOne(() => User, (user) => user.team)
  manager?: User;

  @OneToMany(() => User, (user) => user.manager)
  team?: User[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
