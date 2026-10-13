// TEMPORARY diagnostic probe: runs boot stages on demand over HTTP and
// returns real exit codes + logs (Render hides container logs). Endpoints:
//   /             container facts (redis/admin/env/node)
//   /run/redis   start bundled redis + ping
//   /run/migrate `npx medusa db:migrate` (5 min cap)
//   /run/start   launch `medusa start` on 127.0.0.1:10001, detached
//   /run/startlog / /run/startcheck inspect the launched server
const { execFile, spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 9000;
const STARTLOG = "/tmp/medusa-start.log";
let startChild = null;

function facts() {
  const out = {};
  try {
    out.redisBin = require("child_process").execSync("which redis-server").toString().trim();
  } catch (e) { out.redisBin = "MISSING"; }
  try { out.adminFiles = fs.readdirSync("public/admin").slice(0, 5); }
  catch (e) { out.adminFiles = "MISSING: " + e.message; }
  out.medusaServer = fs.existsSync(".medusa/server");
  out.cwd = process.cwd();
  out.env = {
    hasDb: !!process.env.DATABASE_URL,
    dbStart: (process.env.DATABASE_URL || "").slice(0, 60),
    hasRedis: !!process.env.REDIS_URL,
    port: process.env.PORT || null,
    nodeEnv: process.env.NODE_ENV || null,
  };
  out.node = process.version;
  return out;
}

function runCmd(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, cwd: "/app" },
      (err, stdout, stderr) => resolve({
        code: err ? err.code ?? 1 : 0,
        signal: (err && err.signal) || null,
        stdout: String(stdout || "").slice(-4000),
        stderr: String(stderr || "").slice(-4000),
      }));
  });
}

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj, null, 2));
}

http.createServer(async (q, r) => {
  const url = new URL(q.url, "http://x");
  try {
    if (url.pathname === "/health") { r.statusCode = 200; r.end("OK"); return; }
    if (url.pathname === "/") return send(r, facts());
    if (url.pathname === "/run/redis") {
      const res = await runCmd("redis-server", ["--daemonize", "yes", "--save", "", "--appendonly", "no"], 30000);
      const ping = await runCmd("redis-cli", ["ping"], 15000);
      return send(r, { start: res, ping });
    }
    if (url.pathname === "/run/migrate") {
      return send(r, await runCmd("npx", ["medusa", "db:migrate"], 300000));
    }
    if (url.pathname === "/run/start") {
      if (startChild) return send(r, { already: true });
      const fh = fs.openSync(STARTLOG, "w");
      startChild = spawn("npx", ["medusa", "start", "--port", "10001", "--host", "127.0.0.1"],
        { cwd: "/app", detached: true, stdio: ["ignore", fh, fh] });
      startChild.unref();
      return send(r, { launched: true, pid: startChild.pid });
    }
    if (url.pathname === "/run/startlog") {
      try { return send(r, { log: fs.readFileSync(STARTLOG, "utf8").slice(-6000) }); }
      catch (e) { return send(r, { log: "no log yet" }); }
    }
    if (url.pathname === "/run/startcheck") {
      http.get("http://127.0.0.1:10001/health", (resp) => {
        let b = ""; resp.on("data", (c) => (b += c));
        resp.on("end", () => send(r, { status: resp.statusCode, body: b }));
      }).on("error", (e) => send(r, { status: "conn-failed", error: e.message }))
        .setTimeout(20000, function () { this.destroy(new Error("timeout")); });
      return;
    }
    r.statusCode = 404; r.end("nope");
  } catch (e) { send(r, { error: String(e) }, 500); }
}).listen(PORT, () => console.log("probe up on " + PORT));
