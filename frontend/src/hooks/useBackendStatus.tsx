import React, { createContext, useContext, useState, useEffect } from "react";

interface BackendStatusContextType {
  isOffline: boolean;
  setIsOffline: (val: boolean) => void;
  isStarting: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType>({
  isOffline: false,
  setIsOffline: () => {},
  isStarting: false,
});

export function BackendStatusProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isOffline, setIsOffline] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isFirstCheckDone, setIsFirstCheckDone] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      if (!isFirstCheckDone) {
        setIsStarting(true);
      }
    };
    const handleOnline = () => {
      setIsOffline(false);
      setIsStarting(false);
    };

    window.addEventListener("backend-offline", handleOffline);
    window.addEventListener("backend-online", handleOnline);

    const checkStatus = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
        const baseUrl = apiUrl.replace("/api/v1", "");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${baseUrl}/health`, { 
          mode: "cors",
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          setIsOffline(false);
          setIsStarting(false);
          setIsFirstCheckDone(true);
          window.dispatchEvent(new CustomEvent("backend-online"));
        } else {
          setIsOffline(true);
          if (!isFirstCheckDone) {
            setIsStarting(true);
          }
          window.dispatchEvent(new CustomEvent("backend-offline"));
        }
      } catch {
        setIsOffline(true);
        if (!isFirstCheckDone) {
          setIsStarting(true);
        }
        window.dispatchEvent(new CustomEvent("backend-offline"));
      }
    };

    // Initial check
    checkStatus();

    // Polling scheduler: 5s if offline/starting, 30s if online
    let timerId: any = null;
    const runPing = async () => {
      await checkStatus();
    };

    const intervalDelay = isOffline ? 5000 : 30000;
    timerId = setInterval(runPing, intervalDelay);

    return () => {
      window.removeEventListener("backend-offline", handleOffline);
      window.removeEventListener("backend-online", handleOnline);
      clearInterval(timerId);
    };
  }, [isOffline, isFirstCheckDone]);

  return (
    <BackendStatusContext.Provider value={{ isOffline, setIsOffline, isStarting }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  return useContext(BackendStatusContext);
}
