import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName?: string;
  specialty: string;
  bio: string;
  consultationFee: number;
  yearsOfExperience: number;
  city: string;
  user?: {
    fullName: string;
    email: string;
  };
  profileImage?: string;
  availability?: string;
  isApproved?: boolean;
}

export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const profiles = await fetchApi<DoctorProfile[]>("/DoctorProfiles");
      return profiles;
    },
  });
}

export function useDoctorProfileByUserId(userId?: string) {
  return useQuery({
    queryKey: ["doctor-profile", "user", userId],
    queryFn: () => fetchApi<DoctorProfile>(`/DoctorProfiles/user/${userId}`),
    enabled: !!userId,
  });
}

export function useUpdateDoctorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      fullName: string;
      specialty: string;
      bio: string;
      consultationFee: number;
      yearsOfExperience: number;
      city: string;
      profileImage?: string;
      availability?: string;
    }) =>
      fetchApi(`/DoctorProfiles/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-profile"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
}
