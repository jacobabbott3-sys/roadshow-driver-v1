import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getNotifications, markNotificationRead } from "../lib/communications";

export function NotificationsPage() {
  const notifications = useAsync(getNotifications, []);

  async function markRead(id: string) {
    await markNotificationRead(id);
    await notifications.refresh();
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ACTIVITY</p>
          <h1>Notifications</h1>
          <p>Assignments, scheduled work, and contract updates.</p>
        </div>
      </header>
      <PageState
        loading={notifications.loading}
        error={notifications.error}
        empty={!notifications.data?.length}
      >
        <div className="message-list">
          {notifications.data?.map((notification) => (
            <article
              className={
                notification.read_at
                  ? "notification-card"
                  : "notification-card unread"
              }
              key={notification.id}
            >
              <Bell />
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                <small>
                  {new Date(notification.created_at).toLocaleString()}
                </small>
              </div>
              {notification.link && (
                <Link
                  to={notification.link}
                  onClick={() => void markRead(notification.id)}
                >
                  View
                </Link>
              )}
              {!notification.read_at && (
                <button onClick={() => void markRead(notification.id)}>
                  Mark read
                </button>
              )}
            </article>
          ))}
        </div>
      </PageState>
    </main>
  );
}
