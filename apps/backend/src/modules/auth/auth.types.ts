import type { AccountStatus, ApplicationStatus, UserRole } from "../../generated/prisma/enums.js";

export type Credentials = { email: string; password: string };
export type MerchantRegistration = Credentials & { storeName: string };

export type UserDto = {
  id: number;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  isActive: boolean;
};

export type AuthenticatedUser = UserDto & { merchantIsActive: boolean | null };

export type ApplicationDto = {
  id: number;
  applicantId: number;
  storeName: string;
  status: ApplicationStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
};

export type MerchantDto = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
};

export type LoginIdentity = {
  user: UserDto;
  passwordHash: string;
  applicationStatus: ApplicationStatus | null;
  merchant: MerchantDto | null;
  blacklisted: boolean;
};
