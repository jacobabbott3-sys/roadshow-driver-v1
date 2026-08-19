import { Bell, Mail, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getMessages, getNotifications } from "../lib/communications";
import { supabase } from "../lib/supabase";

export function TopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const messages = useAsync(
    () => getMessages(user!.id),
    [user?.id, location.pathname],
  );
  const notifications = useAsync(
    () => getNotifications(user!.id),
    [user?.id, location.pathname],
  );
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

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`top-bar-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void refreshMessages(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void refreshNotifications(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshMessages, refreshNotifications]);

  useEffect(() => {
    function refreshBadges() {
      void refreshMessages();
      void refreshNotifications();
    }
    window.addEventListener("roadshow:messages-changed", refreshBadges);
    window.addEventListener("roadshow:notifications-changed", refreshBadges);
    return () => {
      window.removeEventListener("roadshow:messages-changed", refreshBadges);
      window.removeEventListener(
        "roadshow:notifications-changed",
        refreshBadges,
      );
    };
  }, [refreshMessages, refreshNotifications]);

  const unreadMessages =
    messages.data?.filter(
      (message) => message.recipient_id === user!.id && !message.read_at,
    ).length || 0;
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
