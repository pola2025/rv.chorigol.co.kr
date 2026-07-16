// 알림 설정 — D1 서버 컴포넌트. 레거시 MessageTemplates/NotificationSettings 대체.
import { listSmsConfigs, listTemplates } from "../../lib/notifications.js";
import NotificationsClient from "./NotificationsClient.jsx";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [configs, templates] = await Promise.all([
    listSmsConfigs(),
    listTemplates(),
  ]);

  return <NotificationsClient configs={configs} templates={templates} />;
}
