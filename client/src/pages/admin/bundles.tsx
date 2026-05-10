import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { BundleManagement } from "@/components/admin/bundle-management";

export default function AdminBundles() {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('adminBundles.title')}>
      <BundleManagement />
    </AdminLayout>
  );
}