// services/api.ts
export function connectLiveActivity(onMessage: (data: any) => void) {
  // Safely get token from localStorage
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No token found in localStorage. WebSocket will not connect.");
    return null; // exit early
  }

  // Use proper path matching your backend
  const wsUrl = `ws://${window.location.hostname}:8000/ws/activity?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => console.log("✅ WebSocket connected");
  ws.onclose = (event) => console.log("❌ WebSocket disconnected", event);
  ws.onerror = (err) => console.error("WebSocket error:", err);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("Failed to parse WS message:", e);
    }
  };

  return ws;
}
