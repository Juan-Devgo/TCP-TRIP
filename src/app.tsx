import { useLocation } from "react-router";

import { MainLayout } from "@/components/layouts/MainLayout";
import { TabHost } from "@/components/layouts/TabHost";
import { SharedProtocolPage, sharedProtocolId } from "@/pages/SharedProtocolPage";

export function App() {
  const { pathname } = useLocation();

  // A share link is not a page of the app: it is public, it opens no tab, and
  // it must render for someone who is signed out. It is absent from
  // `NAVIGATION`, so the tab reducer already ignores the path — this gate only
  // keeps `TabHost` from falling through to "page not found".
  const shareId = sharedProtocolId(pathname);
  if (shareId) return <SharedProtocolPage shareId={shareId} />;

  return (
    <MainLayout>
      <TabHost />
    </MainLayout>
  );
}
