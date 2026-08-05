import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

export type ThemeMode = "light" | "dark" | "system";

export interface UserPreferencesData {
  theme: string;
  language: string;
  timezone: string;
  sidebar_state: string;
  density: string;
  notification_preferences: string;
}

export interface NotificationSoundSettings {
  sound_enabled: boolean;
  volume: number;
  ticket_created: boolean;
  ticket_updated: boolean;
  ticket_resolved: boolean;
  system_alert: boolean;
  chat_message: boolean;
}

export const defaultNotificationSoundSettings: NotificationSoundSettings = {
  sound_enabled: false,
  volume: 50,
  ticket_created: true,
  ticket_updated: true,
  ticket_resolved: true,
  system_alert: true,
  chat_message: true,
};

export function getNotificationSoundSettings(prefString: string): NotificationSoundSettings {
  if (!prefString) return defaultNotificationSoundSettings;
  try {
    if (prefString === "all") {
      return { ...defaultNotificationSoundSettings, sound_enabled: false };
    }
    if (prefString === "none") {
      return {
        sound_enabled: false,
        volume: 0,
        ticket_created: false,
        ticket_updated: false,
        ticket_resolved: false,
        system_alert: false,
        chat_message: false,
      };
    }
    const parsed = JSON.parse(prefString);
    if (parsed && typeof parsed === "object") {
      return {
        sound_enabled: parsed.sound_enabled ?? false,
        volume: parsed.volume ?? 50,
        ticket_created: parsed.ticket_created ?? true,
        ticket_updated: parsed.ticket_updated ?? true,
        ticket_resolved: parsed.ticket_resolved ?? true,
        system_alert: parsed.system_alert ?? true,
        chat_message: parsed.chat_message ?? true,
      };
    }
  } catch {
    // fallback
  }
  return defaultNotificationSoundSettings;
}

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => Promise<void>;
  preferences: UserPreferencesData;
  updatePreference: (key: keyof UserPreferencesData, value: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultPreferences: UserPreferencesData = {
  theme: "system",
  language: "en",
  timezone: "UTC",
  sidebar_state: "expanded",
  density: "normal",
  notification_preferences: "all"
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [preferences, setPreferences] = useState<UserPreferencesData>(() => {
    const cached = localStorage.getItem("user_preferences");
    return cached ? JSON.parse(cached) : defaultPreferences;
  });

  const applyThemeAndDensity = (currentTheme: ThemeMode, currentDensity: string) => {
    const root = window.document.documentElement;
    const body = window.document.body;

    // 1. Resolve Theme
    let resolved: "light" | "dark" = "light";
    if (currentTheme === "dark") {
      resolved = "dark";
    } else if (currentTheme === "light") {
      resolved = "light";
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolved = systemDark ? "dark" : "light";
    }

    if (resolved === "dark") {
      root.classList.add("dark");
      body.classList.add("dark");
      setResolvedTheme("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
      setResolvedTheme("light");
    }

    // 2. Resolve Density
    if (currentDensity === "compact") {
      body.classList.add("compact");
      root.classList.add("compact");
    } else {
      body.classList.remove("compact");
      root.classList.remove("compact");
    }
  };

  const loadPreferences = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const prefs: any = await api.get("/user/preferences");
      if (prefs) {
        const data: UserPreferencesData = {
          theme: prefs.theme,
          language: prefs.language,
          timezone: prefs.timezone,
          sidebar_state: prefs.sidebar_state,
          density: prefs.density,
          notification_preferences: prefs.notification_preferences
        };
        setPreferences(data);
        setThemeState(data.theme as ThemeMode);
        localStorage.setItem("theme", data.theme);
        localStorage.setItem("user_preferences", JSON.stringify(data));
        applyThemeAndDensity(data.theme as ThemeMode, data.density);
      }
    } catch (err) {
      console.error("Failed to load user preferences from database:", err);
    }
  };

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("theme", mode);
    
    // Immediately sync local preferences object
    setPreferences((prev) => {
      const next = { ...prev, theme: mode };
      localStorage.setItem("user_preferences", JSON.stringify(next));
      return next;
    });

    applyThemeAndDensity(mode, preferences.density);

    // Save to PostgreSQL if logged in
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await api.put("/user/preferences", { theme: mode });
      } catch (err) {
        console.error("Failed to persist theme preference to backend:", err);
      }
    }
  };

  const updatePreference = async (key: keyof UserPreferencesData, value: string) => {
    const nextPrefs = { ...preferences, [key]: value };
    setPreferences(nextPrefs);
    localStorage.setItem("user_preferences", JSON.stringify(nextPrefs));

    if (key === "theme") {
      setThemeState(value as ThemeMode);
      localStorage.setItem("theme", value);
    }

    applyThemeAndDensity(key === "theme" ? (value as ThemeMode) : theme, nextPrefs.density);

    // Save to PostgreSQL if logged in
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await api.put("/user/preferences", { [key]: value });
      } catch (err) {
        console.error(`Failed to persist preference ${key} to backend:`, err);
      }
    }
  };

  // Sync theme changes on initial mount and when system settings change
  useEffect(() => {
    applyThemeAndDensity(theme, preferences.density);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (localStorage.getItem("theme") === "system") {
        applyThemeAndDensity("system", preferences.density);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme, preferences.density]);

  // Load preferences from PostgreSQL when a token is present (e.g. initial start, login)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadPreferences();
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        preferences,
        updatePreference,
        loadPreferences
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
