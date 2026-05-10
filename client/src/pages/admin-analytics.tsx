import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import DashboardAnalytics from "@/components/analytics/dashboard-analytics";

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('adminDashboard.analytics')}>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('adminDashboard.analyticsComingSoon')}</h1>
          <p className="text-muted-foreground">
            {t('adminDashboard.analyticsDescription')}
          </p>
        </div>
        <DashboardAnalytics />
      </div>
    </AdminLayout>
  );
}