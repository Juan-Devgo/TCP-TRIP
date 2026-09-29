import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { App } from "@/app";
import { Toaster } from "@/components/ui/toast";
import { PageChromeProvider } from "@/context/PageChromeProvider";
import { PresentableProvider } from "@/context/PresentableProvider";
import { TabsProvider } from "@/context/TabsProvider";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ToolActionsProvider } from "@/context/ToolActionsProvider";
import { shouldRetry } from "@/services/client";
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

/** Server state (saved exercise sets, Classroom data) — see "Server data" in CLAUDE.md. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, refetchOnWindowFocus: false },
  },
});

/**
 * Query keys are not scoped by user, so the cache is dropped whenever the
 * signed-in user changes: nobody sees the previous session's data.
 */
function QueryCacheOwner() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const previous = useRef(userId);

  useEffect(() => {
    if (previous.current !== userId) client.clear();
    previous.current = userId;
  }, [userId, client]);

  return null;
}

function RootLayout() {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {/* There is no <Routes> map: the pathname drives the tab system, which
          resolves it against the page registry in `src/config/navigation.ts`. */}
      <QueryClientProvider client={queryClient}>
        <QueryCacheOwner />
        <TabsProvider>
          <ToolActionsProvider>
            <PresentableProvider>
              <PageChromeProvider>
                {/* One viewport for the whole app, bound to the `toast` manager the
                    tools import directly — a tool reports an outcome without having
                    to reach the provider through context. */}
                <Toaster>
                  <App />
                </Toaster>
              </PageChromeProvider>
            </PresentableProvider>
          </ToolActionsProvider>
        </TabsProvider>
      </QueryClientProvider>
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
