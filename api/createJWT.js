

const jwtLib = require("jsonwebtoken");
const { default: NodeRSA } = require("node-rsa");

/**
 * Load RSA keys from environment variables
 * These should be set in Vercel's environment variable settings
 * Convert \n strings to actual newlines
 */
const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").replace(/\\n/g, '\n');
const IBM_PUBLIC_KEY = (process.env.IBM_PUBLIC_KEY || "").replace(/\\n/g, '\n');

if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY environment variable is not set!");
}

if (!IBM_PUBLIC_KEY) {
  console.error("ERROR: IBM_PUBLIC_KEY environment variable is not set!");
}

/**
 * Generate a simple anonymous ID without uuid
 */
function generateAnonymousId() {
  return `anon-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Create a signed JWT string for the wxO embed chat client
 */
function createJWTString(anonymousUserID, sessionInfo) {
  const jwtContent = {
    sub: anonymousUserID || "anonymous-user",
    user_payload: {
      name: sessionInfo?.userName || "Anonymous User",
      custom_message: "Secure embed chat session",
      custom_user_id: anonymousUserID || "",
      sso_token: "",
    },
    context: {
      clientID: anonymousUserID || "anonymous",
      name: sessionInfo?.userName || "Guest",
      role: sessionInfo?.role || "User",
    },
  };

  // Encrypt the user_payload using IBM's RSA public key
  if (jwtContent.user_payload && IBM_PUBLIC_KEY) {
    try {
      const rsaKey = new NodeRSA();
      rsaKey.importKey(IBM_PUBLIC_KEY, 'pkcs8-public-pem');
      rsaKey.setOptions({ encryptionScheme: 'pkcs1' });
      const dataString = JSON.stringify(jwtContent.user_payload);
      const utf8Data = Buffer.from(dataString, "utf-8");
      jwtContent.user_payload = rsaKey.encrypt(utf8Data, "base64");
      console.log("[JWT] User payload encrypted successfully");
    } catch (error) {
      console.error("[JWT] Error encrypting user_payload:", error);
      throw error;
    }
  }

  // Sign the JWT using RS256 algorithm
  const jwtString = jwtLib.sign(jwtContent, PRIVATE_KEY, {
    algorithm: "RS256",
    expiresIn: "1h",
  });

  console.log("[JWT] Token created with sub:", jwtContent.sub);
  return jwtString;
}

/**
 * Parse session info from cookies
 */
function getSessionInfo(cookies) {
  const sessionInfo = cookies?.SESSION_INFO;
  if (!sessionInfo) return null;
  
  try {
    return JSON.parse(sessionInfo);
  } catch {
    return null;
  }
}

/**
 * Parse cookies from request headers
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

/**
 * Express Middleware Handler
 * Compatible with both Vercel serverless and containerized Express deployment
 */
module.exports = async (req, res) => {
  // CORS headers (handled by Express middleware in server.js for containerized deployment)
  // But kept here for Vercel compatibility
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get user_id from query parameter
    const userIdFromQuery = req.query.user_id;
    
    // Generate anonymous ID if not provided
    const anonymousUserID = userIdFromQuery || generateAnonymousId();
    
    console.log("[JWT Route] Creating JWT for user:", anonymousUserID);
    
    // Parse cookies and get session info
    // In Express, cookies are already parsed by cookie-parser middleware
    const cookies = req.cookies || parseCookies(req.headers.cookie);
    const sessionInfo = getSessionInfo(cookies);

    // Create and sign the JWT
    const token = createJWTString(anonymousUserID, sessionInfo);
    
    console.log("[JWT Route] Token created successfully, length:", token.length);
    
    // Set cookie for anonymous user tracking
    res.cookie('ANONYMOUS-USER-ID', anonymousUserID, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 45 * 24 * 60 * 60 * 1000 // 45 days in milliseconds
    });
    
    // Return the JWT as plain text
    res.status(200).send(token);
  } catch (error) {
    console.error("[JWT Route] Error creating JWT:", error);
    res.status(500).json({
      error: "Error creating JWT",
      message: error.message
    });
  }
};

