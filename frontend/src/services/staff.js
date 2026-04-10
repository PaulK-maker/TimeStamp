import api from "./api";

export async function listStaff() {
  const response = await api.get("/staff");
  return Array.isArray(response.data?.staff) ? response.data.staff : [];
}

export async function updatePayrollProfile(staffId, payload) {
  const response = await api.put(`/staff/${staffId}/payroll-profile`, payload);
  return response.data?.staff || null;
}
