import LoggerApi from "@/core/logger-api";
import { getDoc, updateDoc } from "@/core/doc";
import { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function receberHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const secret = process.env.ANONIMIZADOR_SECRET;
    if (secret && req.headers["x-service-secret"] !== secret) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const { jurisId, anonimizedTexto, originalTexto } = req.body;

    if (!jurisId || !anonimizedTexto) {
        return res.status(400).json({ ok: false, message: "Missing jurisId or anonimizedTexto" });
    }

    try {
        const current = await getDoc(jurisId);
        if (!current._source) {
            return res.status(404).json({ ok: false, message: "Document not found" });
        }

        const update: Record<string, string> = {
            Texto: anonimizedTexto,
        };

        // Only set the original if not already preserved
        if (!current._source["Texto Não Anonimizado"] && originalTexto) {
            update["Texto Não Anonimizado"] = originalTexto;
        }

        await updateDoc(jurisId, update);
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Error in /api/anonimizar/receber:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
});
