/**
 * Wire contract implemented by apps/backend Milestone 2.
 * Exact JSON contract for the authentication and merchant approval routes.
 */
export type BackendRole = "ADMIN" | "MERCHANT" | "MEMBER";
export type BackendApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BackendUserDto {
  id: number;
  email: string;
  role: BackendRole;
  isActive: boolean;
}

export interface BackendApplicationDto {
  id: number;
  applicantId: number;
  storeName: string;
  status: BackendApplicationStatus;
  reviewedById: number | null;
  reviewedAt: string | null;
}

export interface BackendMerchantDto {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: BackendUserDto;
}

export interface MemberRegistrationResponse {
  user: BackendUserDto;
}

export interface MerchantRegistrationResponse {
  user: BackendUserDto;
  application: BackendApplicationDto;
}

export interface ApplicationStatusResponse {
  application: BackendApplicationDto;
}

export interface PendingApplicationsResponse {
  applications: BackendApplicationDto[];
}

export interface ApproveApplicationResponse {
  application: BackendApplicationDto;
  merchant: BackendMerchantDto;
}

export interface RejectApplicationResponse {
  application: BackendApplicationDto;
}

export interface OwnMerchantResponse {
  merchant: BackendMerchantDto;
}

export interface BackendErrorResponse {
  error: string;
}

/** Authentication and merchant approval paths currently mounted by the backend. */
export const milestone2Paths = {
  registerMember: "/api/auth/register/member",
  registerMerchant: "/api/auth/register/merchant",
  applicationStatus: "/api/auth/application-status",
  login: "/api/auth/login",
  pendingApplications: "/api/admin/merchants/pending",
  approveApplication: (id: number) => `/api/admin/merchants/${id}/approve`,
  rejectApplication: (id: number) => `/api/admin/merchants/${id}/reject`,
  ownMerchant: "/api/merchant/me",
} as const;
