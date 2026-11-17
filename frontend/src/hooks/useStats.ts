import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface AdminStats {
  totalPatients: number;
  totalDoctors: number;
  approvedDoctors: number;
  pendingApplications: number;
  totalAppointments: number;
  appointmentsToday: number;
  totalUsers: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchApi<AdminStats>("/Stats"),
  });
}
