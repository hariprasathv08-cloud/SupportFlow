import React, { useState } from "react";
import { Settings as SettingsIcon, ShieldCheck, Clock, Key, Languages, Moon, LayoutGrid, Bell, Sliders } from "lucide-react";
import { useTheme, getNotificationSoundSettings } from "../hooks/useTheme";
import type { NotificationSoundSettings } from "../hooks/useTheme";

export default function Settings() {
  const token = localStorage.getItem("token") || "No Token Found";
  const userRole = localStorage.getItem("role") || "Viewer";
  const { preferences, updatePreference } = useTheme();

  const [savingField, setSavingField] = useState<string | null>(null);

  const soundSettings = getNotificationSoundSettings(preferences.notification_preferences);

  const handlePreferenceChange = async (key: any, value: string) => {
    try {
      setSavingField(key);
      await updatePreference(key, value);
    } catch (err) {
      console.error("Failed to save setting:", err);
    } finally {
      setSavingField(null);
    }
  };

  const handleSoundSettingChange = async (key: keyof NotificationSoundSettings, value: any) => {
    const updated = {
      ...soundSettings,
      [key]: value
    };
    await handlePreferenceChange("notification_preferences", JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col gap-6 select-text">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Workspace Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Control console preferences, timeout behaviors, and API authorization tokens</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Preference Settings Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <Sliders className="h-4.5 w-4.5 text-primary" />
              Console Customization
            </h3>
            
            <div className="space-y-4">
              {/* Theme Settings */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5" />
                  Appearance Mode
                </label>
                <select
                  value={preferences.theme}
                  onChange={(e) => handlePreferenceChange("theme", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                >
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                  <option value="system">System Default (Auto)</option>
                </select>
              </div>

              {/* Language Settings */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5" />
                  Display Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => handlePreferenceChange("language", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              {/* Timezone Settings */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  System Timezone
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => handlePreferenceChange("timezone", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                >
                  <option value="UTC">Coordinated Universal Time (UTC)</option>
                  <option value="EST">Eastern Standard Time (EST / UTC-5)</option>
                  <option value="PST">Pacific Standard Time (PST / UTC-8)</option>
                  <option value="GMT">Greenwich Mean Time (GMT / UTC+0)</option>
                  <option value="IST">Indian Standard Time (IST / UTC+5:30)</option>
                </select>
              </div>

              {/* Sidebar layout */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Sidebar Menu
                  </label>
                  <select
                    value={preferences.sidebar_state}
                    onChange={(e) => handlePreferenceChange("sidebar_state", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                  >
                    <option value="expanded">Expanded</option>
                    <option value="collapsed">Collapsed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5" />
                    Padding Density
                  </label>
                  <select
                    value={preferences.density}
                    onChange={(e) => handlePreferenceChange("density", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                  >
                    <option value="normal">Normal View</option>
                    <option value="compact">Compact View</option>
                  </select>
                </div>
              </div>

              {/* Alerts notifications preferences */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" />
                    Notification Audio Sounds
                  </label>
                  <button
                    onClick={() => handleSoundSettingChange("sound_enabled", !soundSettings.sound_enabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${soundSettings.sound_enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${soundSettings.sound_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {soundSettings.sound_enabled && (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      <span>Playback Volume</span>
                      <span className="text-primary">{soundSettings.volume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="25"
                      value={soundSettings.volume}
                      onChange={(e) => handleSoundSettingChange("volume", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary border border-transparent"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Mute</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-850">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sound Events Toggles</span>
                      <div className="grid grid-cols-2 gap-2.5 text-[10px] text-slate-700 dark:text-slate-300 font-semibold">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={soundSettings.ticket_created}
                            onChange={(e) => handleSoundSettingChange("ticket_created", e.target.checked)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-slate-700 text-primary focus:ring-0 cursor-pointer"
                          />
                          Ticket Created
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={soundSettings.ticket_updated}
                            onChange={(e) => handleSoundSettingChange("ticket_updated", e.target.checked)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-slate-700 text-primary focus:ring-0 cursor-pointer"
                          />
                          Ticket Updated
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={soundSettings.ticket_resolved}
                            onChange={(e) => handleSoundSettingChange("ticket_resolved", e.target.checked)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-slate-700 text-primary focus:ring-0 cursor-pointer"
                          />
                          Ticket Resolved
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={soundSettings.system_alert}
                            onChange={(e) => handleSoundSettingChange("system_alert", e.target.checked)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-slate-700 text-primary focus:ring-0 cursor-pointer"
                          />
                          System Alert
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none col-span-2">
                          <input
                            type="checkbox"
                            checked={soundSettings.chat_message}
                            onChange={(e) => handleSoundSettingChange("chat_message", e.target.checked)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-slate-700 text-primary focus:ring-0 cursor-pointer"
                          />
                          Chat Message
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-150 dark:border-slate-850">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    <span>Browser Notifications</span>
                    <span className={`text-[9px] font-mono ${Notification.permission === 'granted' ? 'text-success' : 'text-warning'}`}>
                      {Notification.permission.toUpperCase()}
                    </span>
                  </div>
                  {Notification.permission !== "granted" ? (
                    <button
                      onClick={async () => {
                        const res = await Notification.requestPermission();
                        if (res === "granted") {
                          new Notification("SupportFlow", { body: "Browser notifications successfully registered!" });
                        }
                        window.location.reload(); 
                      }}
                      className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[10px] font-bold transition-all"
                    >
                      Enable Browser Popups
                    </button>
                  ) : (
                    <p className="text-[9px] text-slate-400">Desktop push notifications will surface in-place during support alerts.</p>
                  )}
                </div>
              </div>
            </div>
            
            {savingField && (
              <span className="text-[10px] text-primary font-semibold mt-3 block animate-pulse">
                Saving preference updates in PostgreSQL database...
              </span>
            )}
          </div>
        </div>

        {/* Info & Security details Card */}
        <div className="space-y-5">
          {/* JWT Token Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-soft flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Key className="h-4.5 w-4.5 text-success" />
                Developer API Key
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pass this JWT Bearer header token for CLI diagnostic runs or cURL operations.
              </p>
              <div className="mt-4 p-3 bg-slate-950 border border-slate-850 rounded-lg select-text font-mono text-[9px] text-green-400 max-h-20 overflow-y-auto break-all scrollbar-thin">
                {token}
              </div>
            </div>
          </div>

          {/* Session limits Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-soft flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Clock className="h-4.5 w-4.5 text-warning" />
                Session Timeout Limits
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Default JWT authorization tokens expire after <b>8 days</b> of inactivity. Modify browser session duration:
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Current Role</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-350 capitalize">{userRole}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Remember Session State</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-350">True</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
