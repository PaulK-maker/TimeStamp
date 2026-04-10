import api from "./api";

export async function listJobs(params = {}) {
  const response = await api.get("/jobs", { params });
  return Array.isArray(response.data?.jobs) ? response.data.jobs : [];
}

export async function listMyJobs() {
  const response = await api.get("/jobs/mine");
  return {
    jobs: Array.isArray(response.data?.jobs) ? response.data.jobs : [],
    defaultJobId: response.data?.defaultJobId || null,
  };
}

export async function createJob(payload) {
  const response = await api.post("/jobs", payload);
  return response.data?.job || null;
}

export async function updateJob(jobId, payload) {
  const response = await api.put(`/jobs/${jobId}`, payload);
  return response.data?.job || null;
}

export async function updateStaffDefaultJob(staffId, jobId) {
  const response = await api.put(`/staff/${staffId}/default-job`, { jobId });
  return response.data?.staff || null;
}