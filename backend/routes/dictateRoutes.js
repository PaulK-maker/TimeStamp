const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

function setupDictateWs(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch { return socket.destroy(); }
    if (url.pathname !== "/ws/dictate") return;

    const token = url.searchParams.get("token");
    if (!token) return socket.destroy();
    try { jwt.verify(token, process.env.JWT_SECRET); }
    catch { return socket.destroy(); }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, url));
  });

  wss.on("connection", (clientWs, url) => {
    if (!process.env.DEEPGRAM_API_KEY) {
      clientWs.send(JSON.stringify({ type: "error", message: "DEEPGRAM_API_KEY not configured on server." }));
      return clientWs.close();
    }

    const sampleRate = parseInt(url.searchParams.get("sr") || "44100", 10);

    const dg = createClient(process.env.DEEPGRAM_API_KEY);
    const conn = dg.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      punctuate: true,
      encoding: "linear16",
      sample_rate: sampleRate,
      channels: 1,
    });

    conn.on(LiveTranscriptionEvents.Open, () => {
      clientWs.on("message", (chunk) => {
        if (conn.getReadyState() === 1) conn.send(chunk);
      });
    });

    conn.on(LiveTranscriptionEvents.Transcript, (data) => {
      const text = data.channel?.alternatives?.[0]?.transcript;
      if (!text) return;
      clientWs.send(JSON.stringify({
        type: data.is_final ? "final" : "interim",
        transcript: text,
      }));
    });

    conn.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("Deepgram WS error:", err);
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, "Deepgram error");
    });

    clientWs.on("close", () => { try { conn.requestClose(); } catch {} });
  });
}

module.exports = setupDictateWs;
