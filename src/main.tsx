import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "@/app";
import { NumberBaseConverterPage } from "@/pages/tools/NumberBaseConverterPage";
import { ThemeProvider } from "@/components/ThemeProvider";
// Side-effect import: this is what initializes i18next. Keep it bare — a bound
// import (`import i18n from ...`) gets dead-code-eliminated by Bun's bundler.
import "@/config/i18n";
import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error('Missing #root element in index.html');

// Inlined at build time by Bun (`env = "PUBLIC_*"` in bunfig.toml / build.ts).
const clerkKey = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!clerkKey) throw new Error('Missing PUBLIC_CLERK_PUBLISHABLE_KEY in .env');
const publishableKey: string = clerkKey;

function RootLayout() {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/tools/converters/number-bases"
          element={<NumberBaseConverterPage />}
        />
      </Routes>
    </ClerkProvider>
  );
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system">
      <BrowserRouter>
        <RootLayout />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
