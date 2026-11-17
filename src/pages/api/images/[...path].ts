import type { NextApiRequest, NextApiResponse } from "next";
import * as fs from "fs";
import * as path from "path";

const MIME_TYPES: Record<string, string> = {
    ".gif": "image/gif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
};

export default async function imageHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", ["GET", "HEAD"]);
        return res.status(405).json({ error: "Method not allowed" });
    }

    const rawPath = req.query.path;
    const pathStr = Array.isArray(rawPath) ? rawPath.join("/") : (rawPath || "");

    // Prevent directory traversal and invalid inputs
    if (!pathStr || pathStr.includes("..") || pathStr.includes("\0") || path.isAbsolute(pathStr)) {
        return res.status(400).json({ error: "Invalid path" });
    }

    const filename = path.basename(pathStr);
    if (!filename) {
        return res.status(400).json({ error: "Invalid path" });
    }

    const baseDir = process.env.IMAGES_PATH || path.join(process.cwd(), "images");
    const filePath = path.join(baseDir, filename);

    // Verify resolved path stays inside baseDir
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    if (!resolvedPath.startsWith(resolvedBase)) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        const stat = await fs.promises.stat(resolvedPath);
        if (!stat.isFile()) {
            return res.status(404).json({ error: "Image not found" });
        }

        const ext = path.extname(filename).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        if (req.method === "HEAD") {
            return res.status(200).end();
        }

        const stream = fs.createReadStream(resolvedPath);
        stream.on("error", (err) => {
            console.error("Error streaming image:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to read image" });
            }
        });
        stream.pipe(res);
    } catch (err: any) {
        if (err.code === "ENOENT") {
            return res.status(404).json({ error: "Image not found" });
        }
        console.error("Error serving image:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

