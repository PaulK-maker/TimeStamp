import api from "./api";

export async function listTemplates() {
  const response = await api.get("/activities/templates");
  return Array.isArray(response.data?.templates) ? response.data.templates : [];
}

export async function createTemplate(payload) {
  const response = await api.post("/activities/templates", payload);
  return response.data?.template || null;
}

export async function updateTemplate(id, payload) {
  const response = await api.patch(`/activities/templates/${id}`, payload);
  return response.data?.template || null;
}

export async function deleteTemplate(id) {
  await api.delete(`/activities/templates/${id}`);
}

export async function listSchedules() {
  const response = await api.get("/activities/schedules");
  return Array.isArray(response.data?.schedules) ? response.data.schedules : [];
}

export async function createSchedule(payload) {
  const response = await api.post("/activities/schedules", payload);
  return response.data?.schedule || null;
}

export async function updateSchedule(id, payload) {
  const response = await api.patch(`/activities/schedules/${id}`, payload);
  return response.data?.schedule || null;
}

export async function deleteSchedule(id) {
  await api.delete(`/activities/schedules/${id}`);
}

export async function exportSchedule(id) {
  const response = await api.get(`/activities/schedules/${id}/export`);
  return response.data || null;
}
