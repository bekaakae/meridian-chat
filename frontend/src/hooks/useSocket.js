import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const TOKEN_TEMPLATE = import.meta.env.VITE_CLERK_JWT_TEMPLATE || "integration_fallback";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;

export function useSocket(getToken) {
  const socketRef = useRef(null);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function initSocket() {
      try {
        const token = typeof getToken === "function"
          ? await getToken({ template: TOKEN_TEMPLATE, skipCache: true })
          : null;

        if (cancelled) {
          return;
        }

        if (!token) {
          console.warn("Socket initialization skipped: missing Clerk token");
          return;
        }

        const socket = io(SOCKET_URL, {
          withCredentials: true,
          transports: ["websocket", "polling"],
          auth: { token }
        });

        socketRef.current = socket;
        setSocketInstance(socket);

        socket.on("connect", () => {
          console.info("Socket.IO connected", socket.id);
        });

        socket.on("connect_error", (error) => {
          console.error("Socket connection error:", error.message);
        });
      } catch (error) {
        console.error("Socket initialization failed", error);
      }
    }

    initSocket();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [getToken]);

  return socketInstance;
}