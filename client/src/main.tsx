import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global fetch wrapper to ensure auth headers + credentials on all requests
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const headers = new Headers(init?.headers || {});
      if (!headers.has("Authorization")) {
        const token = sessionStorage.getItem("token");
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      const wrappedInit: RequestInit = {
        ...init,
        headers,
        credentials: init?.credentials ?? "include",
      };

      return originalFetch(input, wrappedInit);
    } catch {
      return originalFetch(input, init);
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);
