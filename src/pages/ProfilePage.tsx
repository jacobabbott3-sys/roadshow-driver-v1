import {
  BellOff,
  BellRing,
  CalendarDays,
  LogOut,
  Palette,
  Save,
  Sparkles,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  deviceNotificationsSupported,
  disableDeviceNotifications,
  enableDeviceNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
} from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";
import type { ColorScheme, ThemePreference } from "../types";

export function ProfilePage() {
  const { profile, user, signOut, refreshProfile, updateAppearance } = useAuth();
  const preferences = useAsync(
    () => getNotificationPreferences(user!.id),
    [user?.id],
  );
  const [name, setName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [theme, setTheme] = useState<ThemePreference>(profile?.theme_preference || "light");
  const [colorScheme, setColorScheme] = useState<ColorScheme>(profile?.color_scheme || "forest");
  const [extremeConfetti, setExtremeConfetti] = useState(Boolean(profile?.extreme_confetti));
  const [alerts, setAlerts] = useState({
    assignment_alerts: true,
    work_day_alerts: true,
    message_alerts: true,
  });

  useEffect(() => {
    if (!preferences.data) return;
    setAlerts({
      assignment_alerts: preferences.data.assignment_alerts,
      work_day_alerts: preferences.data.work_day_alerts,
      message_alerts: preferences.data.message_alerts,
    });
  }, [preferences.data]);

  useEffect(() => {
    if (!profile) return;
    setTheme(profile.theme_preference || "light");
    setColorScheme(profile.color_scheme || "forest");
    setExtremeConfetti(Boolean(profile.extreme_confetti));
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user!.id);
    setSaving(false);
    setMessage(
      error
        ? error.message
        : "Profile saved. Refresh to see your updated greeting.",
    );
    if (!error) await refreshProfile();
  }

  async function saveAppearance() {
    setSaving(true);
    setMessage("");
    try {
      await updateAppearance(theme, colorScheme, extremeConfetti);
      setMessage("Appearance saved to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save appearance.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeviceNotifications() {
    setDeviceBusy(true);
    setNotificationMessage("");
    try {
      if (preferences.data?.device_notifications) {
        await disableDeviceNotifications(user!.id);
        setNotificationMessage("Device notifications turned off.");
      } else {
        await enableDeviceNotifications(user!.id);
        setNotificationMessage("Device notifications are on for this device.");
      }
      await preferences.refresh();
    } catch (error) {
      setNotificationMessage(
        error instanceof Error
          ? error.message
          : "Unable to update device notifications.",
      );
    } finally {
      setDeviceBusy(false);
    }
  }

  async function saveAlerts() {
    setSaving(true);
    setNotificationMessage("");
    try {
      await saveNotificationPreferences(user!.id, alerts);
      setNotificationMessage("Notification preferences saved.");
      await preferences.refresh();
    } catch (error) {
      setNotificationMessage(
        error instanceof Error
          ? error.message
          : "Unable to save notification preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  const supported = deviceNotificationsSupported();
  const enabled = Boolean(preferences.data?.device_notifications);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Profile</h1>
          <p>Personal details, notifications, and account access.</p>
        </div>
      </header>
      <section className="profile-card">
        <div className="profile-avatar">
          <UserRound size={32} />
        </div>
        <div>
          <h2>{profile?.full_name || "Roadshow team member"}</h2>
          <p>{user?.email}</p>
          <span className="role-pill">{profile?.role || "driver"}</span>
        </div>
      </section>
      <section className="detail-panel profile-form">
        <h2>Contact information</h2>
        <label>
          Full name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Email
          <input value={user?.email || ""} disabled />
        </label>
        <label>
          Phone number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            placeholder="(555) 555-5555"
          />
        </label>
        <button
          className="button primary"
          onClick={() => void saveProfile()}
          disabled={saving}
        >
          <Save size={18} />
          {saving ? "Saving…" : "Save profile"}
        </button>
        {message && <p className="notice">{message}</p>}
      </section>
      <section className="detail-panel profile-form appearance-settings">
        <div className="notification-heading">
          <div className="notification-icon"><Palette /></div>
          <div><h2>Appearance</h2><p>These settings follow your account on every device.</p></div>
        </div>
        <div className="form-grid">
          <label>
            Display mode
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">Match device</option>
            </select>
          </label>
          <label>
            Color scheme
            <select value={colorScheme} onChange={(event) => setColorScheme(event.target.value as ColorScheme)}>
              <option value="forest">Forest</option>
              <option value="blue">Road blue</option>
              <option value="purple">Stage purple</option>
              <option value="rust">Warm rust</option>
            </select>
          </label>
        </div>
        <div className="color-preview" aria-label={`${colorScheme} color preview`}><span /><span /><span /></div>
        <div className="extreme-confetti-setting">
          <div className="notification-icon"><Sparkles /></div>
          <Preference title="Extreme Confetti Mode" description="Launch confetti whenever you click anything in the app" checked={extremeConfetti} onChange={setExtremeConfetti} />
        </div>
        <button className="button secondary" onClick={() => void saveAppearance()} disabled={saving}><Save /> Save appearance</button>
      </section>
      <section className="detail-panel notification-settings">
        <div className="notification-heading">
          <div className="notification-icon">
            <Smartphone />
          </div>
          <div>
            <h2>Device notifications</h2>
            <p>Get alerts even when the app is not open.</p>
          </div>
        </div>
        {!supported ? (
          <p className="muted">
            This browser does not support device notifications. On iPhone or
            iPad, add the app to your Home Screen first.
          </p>
        ) : (
          <button
            className={`button ${enabled ? "secondary" : "primary"}`}
            onClick={() => void toggleDeviceNotifications()}
            disabled={deviceBusy || preferences.loading}
          >
            {enabled ? <BellOff /> : <BellRing />}
            {deviceBusy
              ? "Updating…"
              : enabled
                ? "Turn off on this device"
                : "Turn on device notifications"}
          </button>
        )}
        <div className="preference-list">
          <Preference
            title="Contract assignments"
            description="When a contract is assigned to you"
            checked={alerts.assignment_alerts}
            onChange={(checked) =>
              setAlerts({ ...alerts, assignment_alerts: checked })
            }
          />
          <Preference
            title="Work-day reminders"
            description="On the day of a setup or teardown"
            checked={alerts.work_day_alerts}
            onChange={(checked) =>
              setAlerts({ ...alerts, work_day_alerts: checked })
            }
          />
          <Preference
            title="New chat messages"
            description="When someone replies in one of your chats"
            checked={alerts.message_alerts}
            onChange={(checked) =>
              setAlerts({ ...alerts, message_alerts: checked })
            }
          />
        </div>
        <button
          className="button secondary"
          onClick={() => void saveAlerts()}
          disabled={saving || preferences.loading}
        >
          <Save /> Save alert preferences
        </button>
        {notificationMessage && (
          <p className="notice">{notificationMessage}</p>
        )}
      </section>
      <Link className="profile-link" to="/availability">
        <CalendarDays /> Manage availability <span>→</span>
      </Link>
      <button className="button danger" onClick={() => void signOut()}>
        <LogOut size={18} /> Sign out
      </button>
    </main>
  );
}

function Preference({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="preference-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
