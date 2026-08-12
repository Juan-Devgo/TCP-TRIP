import { useTranslation } from "react-i18next";

import { MainLayout } from "@/components/layouts/MainLayout";
import { NumberBaseConverter } from "@/components/tools/NumberBaseConverter";

export function NumberBaseConverterPage() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <NumberBaseConverter />
    </MainLayout>
  );
}
