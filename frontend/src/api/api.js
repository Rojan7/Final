import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000"; // FastAPI server

// ----- Text search -----
export const searchText = async (query) => {
  const response = await axios.get(`${BASE_URL}/search`, {
    params: { q: query },
  });
  return response.data;
};

// ----- Image search (unified) -----
export const searchImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${BASE_URL}/search/image/unified`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

// ----- Refine search using embedding -----
export const refineSearch = async (baseEmbedding, refinement, alpha = 0.6) => {
  const response = await axios.post(`${BASE_URL}/search/refine`, {
    base_embedding: baseEmbedding,
    refinement,
    alpha,
  });
  return response.data;
};
