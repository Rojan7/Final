import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000"; // your FastAPI server

export const searchText = async (query) => {
  const response = await axios.post(`${BASE_URL}/search/text`, { query });
  return response.data.results;
};

export const searchImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${BASE_URL}/search/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.results;
};
