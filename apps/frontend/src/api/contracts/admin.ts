import type { PlatformFeeSummary } from "./finance";

export type AdminDashboardResponse = {
  stats: {
    merchants: number;
    pendingApplications: number;
    paidOrders: number;
    totalVolume: string | number;
    platformFees?: PlatformFeeSummary;
  };
};

export type AccountStatus = "ACTIVE" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED" | "BANNED";

export type AdminUserRole = "ADMIN" | "MERCHANT" | "MEMBER";

export type AdminAuditAction =
  "USER_STATUS_CHANGED" | "EMAIL_BLACKLISTED" | "EMAIL_BLACKLIST_DEACTIVATED" | "MERCHANT_STATUS_CHANGED";

export type AdminAuditTargetType = "USER" | "EMAIL_BLACKLIST" | "MERCHANT";

export interface AdminUserDto {
  id: number;
  email: string;
  role: AdminUserRole;
  accountStatus: AccountStatus;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUserDto[];
  nextCursor: string | null;
}

export interface AdminUsersQuery {
  search?: string;
  status?: AccountStatus;
  role?: AdminUserRole;
  cursor?: string | number;
  limit?: number;
}

export interface ChangeUserStatusInput {
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  reason: string;
}

export interface AdminUserResponse {
  user: AdminUserDto;
}

export interface ChangeMerchantStatusInput {
  isActive: boolean;
  reason: string;
}

export interface AdminMerchantModerationResponse {
  merchant: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export interface AdminBlacklistEntryDto {
  id: number;
  email: string;
  reason: string;
  isActive: boolean;
  lastActorId: number;
  lastActorEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBlacklistResponse {
  items: AdminBlacklistEntryDto[];
  nextCursor: string | null;
}

export interface AdminBlacklistQuery {
  search?: string;
  active?: boolean;
  cursor?: string | number;
  limit?: number;
}

export interface AddBlacklistInput {
  email: string;
  reason: string;
}

export interface DeactivateBlacklistInput {
  reason: string;
}

export interface AdminBlacklistEntryResponse {
  entry: AdminBlacklistEntryDto;
}

export interface AdminAuditLogDto {
  id: number;
  actorId: number;
  actorEmail: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: number;
  reason: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditLogDto[];
  nextCursor: string | null;
}

export interface AdminAuditLogsQuery {
  actorId?: number;
  action?: AdminAuditAction;
  targetType?: AdminAuditTargetType;
  targetId?: number;
  from?: string;
  to?: string;
  cursor?: string | number;
  limit?: number;
}

export interface CreateAbuseReportInput {
  memberId: number;
  orderId?: number;
  reason: string;
}

export interface MerchantAbuseReportDto {
  id: number;
  merchantId: number;
  reporterId: number;
  memberId: number;
  orderId: number | null;
  reason: string;
  createdAt: string;
}

export interface CreateAbuseReportResponse {
  report: MerchantAbuseReportDto;
}

export interface AdminAbuseReportDto {
  id: number;
  merchantId: number;
  reporterId: number;
  memberId: number;
  orderId: number | null;
  reason: string;
  createdAt: string;
  merchant: {
    id: number;
    name: string;
  };
  reporter: {
    id: number;
    email: string;
  };
  member: {
    id: number;
    email: string;
  };
  order: {
    id: number;
    status: string;
    total: string;
    createdAt: string;
  } | null;
}

export interface AdminAbuseReportsResponse {
  items: AdminAbuseReportDto[];
  nextCursor: string | null;
}

export interface AdminAbuseReportsQuery {
  merchantId?: number;
  memberId?: number;
  cursor?: string | number;
  limit?: number;
}
