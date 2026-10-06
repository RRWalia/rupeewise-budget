import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { supabaseConfigError } from "@/integrations/supabase/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

if (supabaseConfigError) {
  root.render(
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          RupeeWise is temporarily unavailable
        </h1>
        <p style={{ color: "#555", maxWidth: "32rem" }}>{supabaseConfigError}</p>
      </div>
    </div>
  );
} else {
  root.render(<App />);
}
