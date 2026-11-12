import { abuseReportsRepository } from "./abuse-reports.repository.js";
import type { CreateAbuseReportInput } from "./abuse-reports.validation.js";

export const abuseReportsService = {
  create(reporterId: number, input: CreateAbuseReportInput) {
    return abuseReportsRepository.create(reporterId, input);
  },
};
