import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PORT = parseInt(process.env.TRIGGER_PORT || "4000", 10);
const ETL_DIR = "/home/clitools/jurisprudencia-privada-etl";
const TRIGGER_FILE = path.join(ETL_DIR, "results", ".trigger_sharepoint_sync");

let isRunning = false;
let lastRun = null;

function runSync(onStarted) {
    if (isRunning) {
        if (onStarted) onStarted(false, "Sincronização já em curso.");
        return;
    }

    isRunning = true;
    const startTime = new Date();
    console.log(`[trigger-server] Iniciar sincronização do SharePoint em ${startTime.toISOString()}`);

    const proc = spawn("/usr/local/bin/node", ["dist/sharepoint/index.js"], {
        cwd: ETL_DIR,
        env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
        const text = d.toString();
        stdout += text;
        process.stdout.write(text);
    });

    proc.stderr.on("data", (d) => {
        const text = d.toString();
        stderr += text;
        process.stderr.write(text);
    });

    proc.on("close", (code) => {
        isRunning = false;
        const endTime = new Date();
        lastRun = {
            code,
            startTime,
            endTime,
            stdoutTail: stdout.slice(-2000),
            stderrTail: stderr.slice(-2000),
        };
        console.log(`[trigger-server] Sincronização do SharePoint terminada com código ${code} em ${endTime.toISOString()}`);
    });

    if (onStarted) {
        onStarted(true, "Sincronização do SharePoint iniciada em segundo plano.");
    }
}

// Background poller for trigger flag file
setInterval(() => {
    try {
        if (fs.existsSync(TRIGGER_FILE)) {
            console.log(`[trigger-server] Ficheiro trigger detetado: ${TRIGGER_FILE}`);
            try {
                fs.unlinkSync(TRIGGER_FILE);
            } catch {}
            runSync();
        }
    } catch {}
}, 10_000);

const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "POST" && url.pathname === "/sync") {
        runSync((started, message) => {
            res.writeHead(started ? 200 : 409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: started, running: isRunning, message }));
        });
    } else if (req.method === "GET" && url.pathname === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, running: isRunning, lastRun }));
    } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, message: "Not found" }));
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[trigger-server] SharePoint trigger daemon a escutar em 0.0.0.0:${PORT}`);
});
