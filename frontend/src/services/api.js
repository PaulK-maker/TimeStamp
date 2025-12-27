// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:5000/api", // backend URL
// });

// // Attach token automatically
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:5000/api", // your backend base URL
// });
// const API_BASE_URL = "https://timecapcha.onrender.com";

// axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });


// // Attach token to requests if exists
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

import axios from "axios";

// Production backend URL
const API_BASE_URL = "https://timecapcha.onrender.com";

// Create axios instance with base URL
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,  // adds /api to all requests
});

// Attach token automatically to ALL requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;