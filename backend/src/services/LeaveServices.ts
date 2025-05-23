import { UserRole } from "../entities/User";

export function shouldRequireAdminApproval(role: UserRole, duration: number, totalInMonth: number): boolean {
  if (role === UserRole.HR) return true;
  if (role === UserRole.MANAGER && duration >= 5) return true;
  if (role === UserRole.EMPLOYEE && duration >= 5 && totalInMonth >= 5) return true;
  if (role === UserRole.ADMIN) return false;
  if (duration > 5) return true;
  return false;
}
