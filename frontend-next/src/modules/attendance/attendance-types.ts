/** Minimal API shapes for attendance module (ported from legacy views). */

export type LoanRequest = {
  id: string;
  amount: string | number;
  detail?: string | null;
  installmentAmount: string | number;
  remainingAmount: string | number;
  status?: string | null;
  managerApprovedByUserId?: string | null;
  hodApprovedByUserId?: string | null;
  createdAt?: string | Date | null;
  userName?: string | null;
};

export type LeaveRequest = {
  id: string;
  purpose?: string | null;
  leaveType?: string | null;
  reason?: string | null;
  type?: string | null;
  fromDate?: string | Date | null;
  toDate?: string | Date | null;
  status?: string | null;
  createdAt?: string | Date | null;
};

export type OvertimeRecord = {
  id: string;
  taskTitle?: string | null;
  taskDetails?: string | null;
  timeSpent?: number | null;
  status?: string | null;
  createdAt?: string | Date | null;
};
