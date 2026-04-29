import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./Layout";
import { UpcomingPage } from "./pages/UpcomingPage";
import { PastPage } from "./pages/PastPage";
import { SuggestPage } from "./pages/SuggestPage";
import { SuggestEditPage } from "./pages/SuggestEditPage";
import { AdminPage } from "./pages/AdminPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<UpcomingPage />} />
            <Route path="past" element={<PastPage />} />
            <Route path="suggest" element={<SuggestPage />} />
            <Route path="suggest-edit/:slug" element={<SuggestEditPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
