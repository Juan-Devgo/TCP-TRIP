import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "@/app";
import { TabsProvider } from "@/components/TabsProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToolActionsProvider } from "@/components/ToolActionsProvider";
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
      {/* There is no <Routes> map: the pathname drives the tab system, which
          resolves it against the page registry in `src/config/pages.ts`. */}
      <TabsProvider>
        <ToolActionsProvider>
          <App />
        </ToolActionsProvider>
      </TabsProvider>
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
