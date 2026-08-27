import api from "./api";

export async function listTraining(params = {}) {
  const response = await api.get("/training", { params });
  return Array.isArray(response.data?.records) ? response.data.records : [];
}

export async function createTraining(payload) {
  const response = await api.post("/training", payload);
  return response.data?.record || null;
}

export async function updateTraining(id, payload) {
  const response = await api.patch(`/training/${id}`, payload);
  return response.data?.record || null;
}

export async function deleteTraining(id) {
  await api.delete(`/training/${id}`);
}
