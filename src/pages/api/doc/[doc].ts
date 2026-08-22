import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { createDoc, deleteDoc, existsDoc, getDoc, updateDoc } from "@/core/doc";
import LoggerApi from "@/core/logger-api";
import { sendSyncEditEmail } from "@/core/email-sync";
import { logAuditEvent, getUsernameFromReq, getIpFromReq } from "@/core/audit-log";

export default LoggerApi(async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    const authed = await authenticatedHandler(req);
    if( !authed ){
        return res.status(401).json({});
    }

    const id = req.query.doc as string;
    if( !(await existsDoc(id)) ){
        return res.status(404).json({})
    }

    if( req.method === "GET" ){
        return res.json(await getDoc(id));
    }

    if( req.method === "PUT" ){
        try{
            const content = JSON.parse(req.body);
            const current = await getDoc(id);
            if (current._source) {
                try {
                    const { moveDecision } = await import("@stjiris/filesystem-lib");
                    moveDecision(current._source, content);
                } catch (fsErr) {
                    console.error("doc PUT: moveDecision failed:", fsErr);
                }
            }
            const result = await updateDoc(id, content);

            // Propagate edits to external deployment if document is público
            if (process.env.SYNC_ROLE === "interno") {
                const uuid = current._source?.UUID;
                const state = (content.STATE ?? current._source?.STATE) as string | undefined;
                if (uuid && state === "público") {
                    try {
                        await sendSyncEditEmail(uuid, content);
                    } catch (emailErr) {
                        console.error("doc PUT: Failed to send sync edit email:", emailErr);
                    }
                }
            }

            logAuditEvent("editar", getUsernameFromReq(req), {
                documentId: id,
                documentProcesso: current._source?.["Número de Processo"],
                ip: getIpFromReq(req),
            });

            return res.json(result);
        }
        catch(e){
            return res.status(400).json({})
        }
    }

    if( req.method === "DELETE" ){
        let document = await getDoc(id);
        if( document._source?.STATE === "eliminado" ){
            try {
                const { markForReintroduction } = await import("@stjiris/filesystem-lib");
                markForReintroduction(document._source);
            } catch (fsErr) {
                console.error("doc DELETE: markForReintroduction failed:", fsErr);
            }
            logAuditEvent("eliminar", getUsernameFromReq(req), {
                documentId: id,
                documentProcesso: document._source?.["Número de Processo"],
                details: "permanent delete",
                ip: getIpFromReq(req),
            });
            return res.json(await deleteDoc(id))
        }
        else if( document._source ){
            logAuditEvent("eliminar", getUsernameFromReq(req), {
                documentId: id,
                documentProcesso: document._source?.["Número de Processo"],
                details: "soft delete (STATE → eliminado)",
                ip: getIpFromReq(req),
            });
            return res.json(await updateDoc(id, {STATE: "eliminado"}))
        }
    }
    return res.status(405).json({})
});