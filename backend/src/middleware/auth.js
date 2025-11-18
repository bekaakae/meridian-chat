const { createClerkClient, verifyToken: clerkVerifyToken } = require("@clerk/backend");

const secretKey = process.env.CLERK_SECRET_KEY;
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
const TOKEN_TPL = process.env.CLERK_JWT_TEMPLATE || "integration_fallback";

const clerkClient = createClerkClient({
  secretKey,
  publishableKey
});

function extractBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme !== "Bearer" || !value) return null;
  return value.trim();
}

async function verifyToken(token) {
  if (!secretKey) {
    const err = new Error("CLERK_SECRET_KEY is not configured");
    err.code = "MISSING_SECRET";
    throw err;
  }

  const baseOptions = { secretKey };
  if (!token) {
    const err = new Error("Token missing");
    err.code = "TOKEN_MISSING";
    throw err;
  }

  try {
    const options = TOKEN_TPL
      ? { ...baseOptions, template: TOKEN_TPL }
      : baseOptions;
    return await clerkVerifyToken(token, options);
  } catch (err) {
    // if a custom template is configured, propagate the error
    if (process.env.CLERK_JWT_TEMPLATE) {
      throw err;
    }

    // fall back to template-less verification for legacy/dev tokens
    if (TOKEN_TPL) {
      return await clerkVerifyToken(token, baseOptions);
    }
    throw err;
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ message: "Missing Authorization token" });
    }

    const claims = await verifyToken(token);
    if (!claims?.sub) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.auth = {
      userId: claims.sub,
      sessionId: claims.sid,
      claims
    };

    return next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = {
  requireAuth,
  clerkClient,
  verifyToken
};