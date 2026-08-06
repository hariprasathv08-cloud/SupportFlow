import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { hostname, port, origin } = window.location;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port !== "8000" && port !== "") {
    return "http://127.0.0.1:8000/api/v1";
  }
  return `${origin}/api/v1`;
};

interface BackendStatusContextType {
  isOffline: boolean;
  setIsOffline: (val: boolean) => void;
  isStarting: boolean;
  isUnreachable: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType>({
  isOffline: false,
  setIsOffline: () => {},
  isStarting: false,
  isUnreachable: false,
});

export function BackendStatusProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isOffline, setIsOffline] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUnreachable, setIsUnreachable] = useState(false);
  const [isFirstCheckDone, setIsFirstCheckDone] = useState(false);
  
  const failedAttemptsRef = useRef(0);
  const isFirstCheckDoneRef = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      if (!isFirstCheckDoneRef.current) {
        setIsStarting(true);
      }
    };
    const handleOnline = () => {
      setIsOffline(false);
      setIsStarting(false);
      setIsUnreachable(false);
    };

    window.addEventListener("backend-offline", handleOffline);
    window.addEventListener("backend-online", handleOnline);

    const checkStatus = async () => {
      if (failedAttemptsRef.current >= 5) {
        setIsUnreachable(true);
        setIsOffline(true);
        setIsStarting(false);
        return false;
      }

      try {
        const apiUrl = getApiUrl();
        const baseUrl = apiUrl.replace("/api/v1", "");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds maximum timeout
        
        const res = await fetch(`${baseUrl}/health`, { 
          mode: "cors",
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          failedAttemptsRef.current = 0;
          setIsOffline(false);
          setIsStarting(false);
          setIsUnreachable(false);
          isFirstCheckDoneRef.current = true;
          setIsFirstCheckDone(true);
          window.dispatchEvent(new CustomEvent("backend-online"));
          return true;
        } else {
          throw new Error("unhealthy");
        }
      } catch (err) {
        failedAttemptsRef.current += 1;
        setIsOffline(true);
        if (failedAttemptsRef.current >= 5) {
          setIsUnreachable(true);
          setIsStarting(false);
        } else if (!isFirstCheckDoneRef.current) {
          setIsStarting(true);
        }
        window.dispatchEvent(new CustomEvent("backend-offline"));
        return false;
      }
    };

    // Initial check
    checkStatus();

    // Setup polling
    const interval = setInterval(async () => {
      if (failedAttemptsRef.current >= 5) {
        clearInterval(interval);
        return;
      }
      await checkStatus();
    }, isOffline ? 5000 : 30000);

    return () => {
      window.removeEventListener("backend-offline", handleOffline);
      window.removeEventListener("backend-online", handleOnline);
      clearInterval(interval);
    };
  }, [isOffline, isFirstCheckDone]);

  return (
    <BackendStatusContext.Provider value={{ isOffline, setIsOffline, isStarting, isUnreachable }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  return useContext(BackendStatusContext);
}

