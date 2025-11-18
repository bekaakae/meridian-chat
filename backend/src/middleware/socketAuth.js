const { verifyToken } = require("./auth");

function extractSocketToken(handshake) {
  if (handshake.auth && typeof handshake.auth.token === "string") {
    return handshake.auth.token;
  }

  const header = handshake.headers?.authorization || handshake.headers?.Authorization;
  if (!header) return null;

  const [scheme, value] = header.split(" ");
  if (scheme === "Bearer" && value) {
    return value.trim();
  }

  return null;
}

function socketAuthMiddleware(socket, next) {
  (async () => {
    try {
      const token = extractSocketToken(socket.handshake);
      if (!token) {
        const err = new Error("Unauthorized");
        err.data = { code: "UNAUTHORIZED", message: "Token missing" };
        throw err;
      }

      const claims = await verifyToken(token);
      if (!claims?.sub) {
        const err = new Error("Unauthorized");
        err.data = { code: "UNAUTHORIZED", message: "Invalid token" };
        throw err;
      }

      socket.data = {
        ...socket.data,
        userId: claims.sub,
        sessionId: claims.sid,
        claims
      };

      next();
    } catch (error) {
      next(error);
    }
  })();
}

module.exports = {
  socketAuthMiddleware
};