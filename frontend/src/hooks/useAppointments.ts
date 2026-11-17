import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  reason: string;
  status: number;
  patient?: {
    fullName: string;
    email: string;
  };
  doctor?: {
    fullName: string;
    email: string;
  };
  doctorProfile?: {
    id: string;
    userId: string;
    fullName: string;
    specialty: string;
    consultationFee: number;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}

export const appointmentStatusLabel: Record<number, string> = {
  0: "pending",
  1: "confirmed",
  2: "cancelled",
  3: "completed",
};

export function usePatientAppointments(patientId?: string) {
  return useQuery({
    queryKey: ["appointments", "patient", patientId],
    queryFn: () => fetchApi<Appointment[]>(`/Appointments/patient/${patientId}`),
    enabled: !!patientId,
  });
}

export function useDoctorAppointments() {
  return useQuery({
    queryKey: ["appointments", "doctor", "me"],
    queryFn: () => fetchApi<Appointment[]>(`/Appointments/doctor/me`),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/Appointments/${id}/cancel`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useConfirmAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/Appointments/${id}/confirm`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}
