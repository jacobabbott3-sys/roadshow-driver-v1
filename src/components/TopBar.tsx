import { Bell, Mail, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getMessages, getNotifications } from "../lib/communications";

export function TopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const messages = useAsync(
    () => getMessages(user!.id),
    [user?.id, location.pathname],
  );
  const notifications = useAsync(getNotifications, [location.pathname]);
  const refreshMessages = messages.refresh;
  const refreshNotifications = notifications.refresh;
  const [dark, setDark] = useState(
    () => localStorage.getItem("roadshow-theme") === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("roadshow-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshMessages();
      void refreshNotifications();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshMessages, refreshNotifications]);

  const unreadMessages =
    messages.data?.filter((message) => !message.read_at).length || 0;
  const unreadNotifications =
    notifications.data?.filter((notification) => !notification.read_at)
      .length || 0;

  return (
    <header className="top-bar">
      <button aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>
        {dark ? <Sun /> : <Moon />}
      </button>
      <Link
        to="/notifications"
        aria-label={`${unreadNotifications} unread notifications`}
      >
        <Bell />
        {unreadNotifications > 0 && (
          <span>{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
        )}
      </Link>
      <Link to="/messages" aria-label={`${unreadMessages} unread messages`}>
        <Mail />
        {unreadMessages > 0 && (
          <span>{unreadMessages > 9 ? "9+" : unreadMessages}</span>
        )}
      </Link>
    </header>
  );
}
