import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_TEMPLATE = import.meta.env.VITE_CLERK_JWT_TEMPLATE || "integration_fallback";

const createAuthenticatedClient = (getToken) => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json"
    }
  });

  instance.interceptors.request.use(async (config) => {
  if (typeof getToken !== 'function') {
    console.warn('getToken is not a function');
    return config;
  }

  try {
    const token = await getToken({ 
      template: TOKEN_TEMPLATE, 
      skipCache: true 
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No Clerk token available');
    }
  } catch (error) {
    console.error('Failed to retrieve Clerk token:', error);
    // Don't throw here, let the request continue without auth
    // The backend will return 401 if auth is required
  }

  return config;
});

  instance.interceptors.request.use(async (config) => {
    if (typeof getToken !== "function") return config;

    try {
      const token = await getToken({ template: TOKEN_TEMPLATE, skipCache: true });
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`
        };
      } else {
        console.warn("Clerk getToken returned empty value; request will be unauthenticated");
      }
    } catch (error) {
      console.error("Failed to retrieve Clerk token", error);
    }

    return config;
  });

  return instance;
};

export function createApiClient(getToken) {
  const client = createAuthenticatedClient(getToken);

  return {
    users: {
      async list() {
        const res = await client.get("/api/users");
        return res.data;
      },
      async syncProfile(payload) {
        const res = await client.post("/api/users/sync", payload);
        return res.data;
      }
    },
    conversations: {
      async list() {
        const res = await client.get("/api/conversations");
        return res.data;
      },
      async ensureConversation(targetUserId) {
        const res = await client.post("/api/conversations", { targetUserId });
        return res.data;
      },
      async getDetail(conversationId) {
        const res = await client.get(`/api/conversations/${conversationId}`);
        return res.data;
      }
    },
    messages: {
      async list(conversationId) {
        const res = await client.get(`/api/messages/${conversationId}`);
        return res.data;
      },
      async send(conversationId, text) {
        const res = await client.post("/api/messages", {
          conversationId,
          text
        });
        return res.data;
      }
    }
  };
}