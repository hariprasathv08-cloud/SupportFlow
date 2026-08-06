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
    
    const audio = new Audio("https://actions.google.com/sounds/v1/alerts/chime.ogg");
    audio.volume = soundSettings.volume / 100;
    audio.play().catch((e) => console.log("Audio play blocked by browser:", e));
  } catch (err) {
    console.error("Audio playback failed:", err);
  }
};

// Module-level globals for shared WebSocket singleton state
let globalSocket: WebSocket | null = null;
let globalConnected = false;
let globalStatus: "connecting" | "connected" | "unavailable" = "connecting";
let globalDevicesMetrics: Record<number, SystemMetrics> = {};
let globalHistories: Record<number, { cpu: number[]; ram: number[] }> = {};
const listeners = new Set<() => void>();

let reconnectDelay = 1000;
let connectionTimeoutId: any = null;
let heartbeatIntervalId: any = null;

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("[WS] Listener error:", e);
    }
  }
}

function initGlobalSocket() {
  if (globalSocket && (globalSocket.readyState === WebSocket.CONNECTING || globalSocket.readyState === WebSocket.OPEN)) {
    return; // Already open or opening
  }

  const token = localStorage.getItem("token") || "";
  if (!token) {
    globalStatus = "connecting";
    globalConnected = false;
    notifyListeners();
    return;
  }

  const isProd = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  
  let host = "localhost:8000";
  if (isProd) {
    host = "supportflow-1.onrender.com";
  } else if (import.meta.env.VITE_WS_URL) {
    host = import.meta.env.VITE_WS_URL;
  }
  
  const wsUrl = `${wsProtocol}//${host}/api/ws?token=${token}`;
  
  console.log(`[WS] Connecting to: ${wsUrl}`);
  globalStatus = "connecting";
  notifyListeners();

  clearTimeout(connectionTimeoutId);
  connectionTimeoutId = setTimeout(() => {
    if (globalStatus === "connecting") {
      console.warn("[WS] Unreachable backend. Setting status to unavailable.");
      globalStatus = "unavailable";
      notifyListeners();
    }
  }, 5000);

  try {
    const socket = new WebSocket(wsUrl);
    globalSocket = socket;

    socket.onopen = () => {
      console.log("[WS] Connected successfully.");
      console.log("[WS] Authenticated successfully with token.");
      clearTimeout(connectionTimeoutId);
      globalConnected = true;
      globalStatus = "connected";
      reconnectDelay = 1000;
      notifyListeners();

      // Setup Render-safe heartbeat to prevent idle disconnections
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
          console.log("[WS] Sent heartbeat ping to keep connection alive.");
        }
      }, 20000);
    };

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === "pong") {
          console.log("[WS] Heartbeat pong received.");
          return;
        }
        
        if (packet.type === "metrics_update") {
          const data: SystemMetrics = packet.data;
          const devId = packet.device_id || 0;
          
          globalDevicesMetrics[devId] = data;
          
          const prevHist = globalHistories[devId] || { cpu: [], ram: [] };
          const updatedCpu = [...prevHist.cpu, data.cpu.usage_percent].slice(-20);
          const updatedRam = [...prevHist.ram, data.ram.percent].slice(-20);
          globalHistories[devId] = { cpu: updatedCpu, ram: updatedRam };
          
          notifyListeners();
        } else if (packet.type === "new_alert") {
          if (packet.alert.severity === "Critical") {
            playNotificationSound("system_alert");
          }
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
        console.error("[WS] Error parsing message:", err);
      }
    };

    socket.onclose = () => {
      console.log("[WS] Disconnected from server.");
      globalConnected = false;
      clearInterval(heartbeatIntervalId);
      
      console.log(`[WS] Reconnecting... Delayed by ${reconnectDelay}ms`);
      globalStatus = "connecting";
      notifyListeners();
      
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      
      setTimeout(() => {
        initGlobalSocket();
      }, delay);
    };

    socket.onerror = (err) => {
      console.error("[WS] WebSocket encountered error:", err);
      socket.close();
    };

  } catch (e) {
    console.error("[WS] Exception starting WebSocket:", e);
    globalConnected = false;
    globalStatus = "unavailable";
    notifyListeners();
  }
}

export function useWebSocket(selectedDeviceId: number | null = null) {
  const [, setTrigger] = useState(0);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    const listener = () => setTrigger((t) => t + 1);
    listeners.add(listener);
    
    initGlobalSocket();

    return () => {
      listeners.delete(listener);
    };
  }, [token]);

  useEffect(() => {
    if (selectedDeviceId !== null && globalConnected) {
      console.log(`[WS] Device subscribed. Tracking ID: ${selectedDeviceId}`);
    }
  }, [selectedDeviceId, globalConnected]);

  const metrics = selectedDeviceId ? (globalDevicesMetrics[selectedDeviceId] || null) : null;
  const cpuHistory = selectedDeviceId ? (globalHistories[selectedDeviceId]?.cpu || []) : [];
  const ramHistory = selectedDeviceId ? (globalHistories[selectedDeviceId]?.ram || []) : [];

  return { 
    metrics, 
    cpuHistory, 
    ramHistory, 
    connected: globalConnected,
    status: globalStatus,
    devicesMetrics: globalDevicesMetrics,
    histories: globalHistories
  };
}
