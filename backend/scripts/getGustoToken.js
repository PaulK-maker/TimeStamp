/**
 * Temporary script to get a fresh Gusto sandbox access token via OAuth.
 * Run: node backend/scripts/getGustoToken.js
 * Then visit the URL printed in the console.
 */
const http = require("http");
const https = require("https");
const { exec } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const CLIENT_ID = process.argv[2] || process.env.GUSTO_CLIENT_ID || "";
const CLIENT_SECRET = process.argv[3] || process.env.GUSTO_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:5001/api/auth/gusto/callback";
const AUTH_BASE = "https://api.gusto-demo.com";
const TOKEN_URL = `${AUTH_BASE}/oauth/token`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Usage: node getGustoToken.js <client_id> <client_secret>");
  process.exit(1);
}

const authUrl =
  `${AUTH_BASE}/oauth/authorize` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

console.log("\n=== Gusto OAuth Token Fetcher ===");
console.log("\nOpen this URL in your browser and log in with demo company credentials:");
console.log("\n" + authUrl + "\n");

// Open the URL automatically on Windows
exec(`start "" "${authUrl}"`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:9876`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("No code received. Try again.");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h2>Authorization code received. Check your terminal for the access token.</h2>");

  console.log("\nAuthorization code received. Exchanging for access token...");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  }).toString();

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const tokenReq = https.request(TOKEN_URL, options, (tokenRes) => {
    let data = "";
    tokenRes.on("data", (chunk) => { data += chunk; });
    tokenRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.access_token) {
          console.log("\n✅ SUCCESS! Your new Gusto access token:");
          console.log("\n" + parsed.access_token + "\n");
          console.log("Token type:", parsed.token_type);
          console.log("Expires in:", parsed.expires_in, "seconds");
          if (parsed.refresh_token) {
            console.log("Refresh token:", parsed.refresh_token);
          }
          console.log("\nUpdate GUSTO_COMPANY_ACCESS_TOKEN in backend/.env with the token above.");
        } else {
          console.error("\n❌ Token exchange failed:");
          console.error(data);
        }
      } catch {
        console.error("\n❌ Failed to parse token response:", data);
      }
      server.close();
      process.exit(0);
    });
  });

  tokenReq.on("error", (err) => {
    console.error("Token request error:", err.message);
    server.close();
    process.exit(1);
  });

  tokenReq.write(body);
  tokenReq.end();
});

server.listen(9876, () => {
  console.log("Waiting for OAuth callback on http://localhost:9876/callback ...");
  console.log("(The browser should open automatically)\n");
});
