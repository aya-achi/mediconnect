import { fetchApi } from "@/lib/api";

export async function createDoctorProfile(payload: {
  userId: string;
  fullName: string;
  specialty: string;
  bio: string;
  consultationFee: number;
  yearsOfExperience: number;
  city: string;
  profileImage?: string;
  availability?: string;
}) {
  return fetchApi("/DoctorProfiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
