export const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? (window.location.port === "3000" ? "" : "http://localhost:3000")
  : "";
