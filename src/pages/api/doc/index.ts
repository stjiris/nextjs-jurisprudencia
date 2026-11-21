import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { createDoc, createSimpleDoc, deleteDoc, getDoc, updateDoc } from "@/core/doc";
import LoggerApi from "@/core/logger-api";

export default LoggerApi(async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({ ok: false, message: "Sessão não autenticada. Por favor inicie sessão novamente." });
    }
    const simple = req.query.mode === "simple";
    if (req.method === "POST") {
        try {
            const content = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
            if (simple) {
                return res.json(await createSimpleDoc(content))
            }
            return res.json(await createDoc(content))
        }
        catch (e: any) {
            console.error("doc POST error:", e);
            return res.status(400).json({ ok: false, message: `Erro ao criar documento: ${e?.message || "dados inválidos"}` });
        }
    }

    return res.status(405).json({ ok: false, message: `Método ${req.method} não suportado neste endpoint.` })
});
