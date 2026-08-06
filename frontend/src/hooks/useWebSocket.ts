import { useEffect, useState, useRef } from "react";
import { getNotificationSoundSettings } from "./useTheme";
import type { NotificationSoundSettings } from "./useTheme";

export interface SystemMetrics {
  cpu: {
    usage_percent: number;
    frequency_mhz?: number;
    cores_physical?: number;
    cores_logical?: number;
    temperature?: number | null;
  };
  ram: {
    total_gb?: number;
    used_gb?: number;
    free_gb?: number;
    percent: number;
  };
  disks: Array<{
    device: string;
    total_gb?: number;
    used_gb?: number;
    free_gb?: number;
    percent: number;
  }>;
  network_sent_mbs: number;
  network_recv_mbs: number;
  defender_status: string;
  firewall_status: string;
  internet_status: boolean;
  services_running_count: number;
  open_tickets_count: number;
  resolved_tickets_count: number;
  critical_alerts_count: number;
  health_score: number;
}

const playNotificationSound = (type: keyof NotificationSoundSettings) => {
  const preferences = localStorage.getItem("user_preferences");
  if (!preferences) return;
  try {
    const prefs = JSON.parse(preferences);
    const soundSettings = getNotificationSoundSettings(prefs.notification_preferences);
    
    if (!soundSettings.sound_enabled) return;
    if (!soundSettings[type]) return; // Disabled for this specific notification type
    
    // Only load and play when allowed (no preload/playback when sound is disabled)
    const audio = new Audio("https://actions.google.com/sounds/v1/alerts/chime.ogg");
    audio.volume = soundSettings.volume / 100;
    audio.play().catch((e) => console.log("Audio play blocked by browser:", e));
  } catch (err) {
    console.error("Audio playback failed:", err);
  }
};

export function useWebSocket(selectedDeviceId: number | null = null) {
  // Store metrics keyed by device_id (fallback local has device_id 0 or null)
  const [devicesMetrics, setDevicesMetrics] = useState<Record<number, SystemMetrics>>({});
  const [histories, setHistories] = useState<Record<number, { cpu: number[]; ram: number[] }>>({});
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: number;

    const connect = () => {
      const token = localStorage.getItem("token") || "";
      let wsUrl = "";
      const api_url = import.meta.env.VITE_API_URL || "";
      if (api_url) {
        try {
          const url = new URL(api_url);
          const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = `${wsProtocol}//${url.host}/api/ws?token=${token}`;
        } catch {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const host = import.meta.env.VITE_WS_URL || "127.0.0.1:8000";
          wsUrl = `${protocol}//${host}/api/ws?token=${token}`;
        }
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = import.meta.env.VITE_WS_URL || "127.0.0.1:8000";
        wsUrl = `${protocol}//${host}/api/ws?token=${token}`;
      }

      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected.");
        setConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          
          if (packet.type === "metrics_update") {
            const data: SystemMetrics = packet.data;
            const devId = packet.device_id || 0; // fallback to 0 if not set
            
            setDevicesMetrics((prev) => ({
              ...prev,
              [devId]: data
            }));

            setHistories((prev) => {
              const prevHist = prev[devId] || { cpu: [], ram: [] };
              const updatedCpu = [...prevHist.cpu, data.cpu.usage_percent].slice(-20);
              const updatedRam = [...prevHist.ram, data.ram.percent].slice(-20);
              return {
                ...prev,
                [devId]: { cpu: updatedCpu, ram: updatedRam }
              };
            });
          } else if (packet.type === "new_alert") {
            if (packet.alert.severity === "Critical") {
              playNotificationSound("system_alert");
            }
            
            // Trigger a custom event for toaster to pick up
            const customEvent = new CustomEvent("sys_alert", { detail: packet.alert });
            window.dispatchEvent(customEvent);
          } else if (packet.type === "alert_resolved") {
            const customEvent = new CustomEvent("sys_alert_resolved", { detail: packet.alert_id });
            window.dispatchEvent(customEvent);
          } else if (packet.type === "new_ticket") {
            const userName = localStorage.getItem("user_name");
            if (packet.ticket.created_by !== userName) {
              playNotificationSound("ticket_created");
              if (Notification.permission === "granted") {
                new Notification("New Support Ticket", {
                  body: `Ticket #${1000 + packet.ticket.id} created by ${packet.ticket.created_by}: ${packet.ticket.title}`
                });
              }
            }
          } else if (packet.type === "ticket_update") {
            const isResolved = packet.status === "Resolved";
            playNotificationSound(isResolved ? "ticket_resolved" : "ticket_updated");
            if (Notification.permission === "granted") {
              new Notification(isResolved ? "Ticket Resolved" : "Ticket Updated", {
                body: `Ticket #${1000 + packet.ticket_id} status changed to ${packet.status}.`
              });
            }
          } else if (packet.type === "ticket_message") {
            const userName = localStorage.getItem("user_name");
            if (packet.message.sender !== userName) {
              playNotificationSound("chat_message");
              if (Notification.permission === "granted") {
                new Notification(`Message from ${packet.message.sender}`, {
                  body: packet.message.message
                });
              }
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected. Attempting reconnection...");
        setConnected(false);
        reconnectTimeout = window.setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket encountered an error:", err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Helpers to get metrics for the selected device
  const metrics = selectedDeviceId ? (devicesMetrics[selectedDeviceId] || null) : null;
  const cpuHistory = selectedDeviceId ? (histories[selectedDeviceId]?.cpu || []) : [];
  const ramHistory = selectedDeviceId ? (histories[selectedDeviceId]?.ram || []) : [];

  return { 
    metrics, 
    cpuHistory, 
    ramHistory, 
    connected,
    devicesMetrics,
    histories
  };
}
