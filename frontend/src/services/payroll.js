import api from "./api";

export async function listPayrollRuns() {
  const res = await api.get("/admin/payroll-runs");
  return Array.isArray(res.data?.payrollRuns) ? res.data.payrollRuns : [];
}

export async function createPayrollRun(payload) {
  const res = await api.post("/admin/payroll-runs", payload);
  return res.data;
}

export async function submitPayrollRun(runId) {
  const res = await api.post(`/admin/payroll-runs/${runId}/submit`);
  return res.data;
}

export async function listPayrollWebhookEvents() {
  const res = await api.get("/admin/payroll-webhook-events");
  return Array.isArray(res.data?.events) ? res.data.events : [];
}