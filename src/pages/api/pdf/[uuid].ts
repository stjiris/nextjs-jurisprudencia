import { createReadStream } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { getDocByUUID } from "@/core/doc";
import { getPdfPath } from "@/core/pdf";
import { PUBLIC_STATES } from "@/core/elasticsearch";
import { authenticatedHandler } from "@/core/user/authenticate";
import LoggerApi from "@/core/logger-api";

export default LoggerApi(async function pdfHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") return res.status(405).json({});

    const uuid = req.query.uuid as string;

    const result = await getDocByUUID(uuid);
    const doc = result.hits.hits[0];
    if (!doc?._source) return res.status(404).json({});

    if (!doc._source.STATE || !PUBLIC_STATES.includes(doc._source.STATE)) {
        if (!(await authenticatedHandler(req))) {
            return res.status(401).json({});
        }
    }

    const pdfPath = getPdfPath(uuid);
    if (!pdfPath) return res.status(404).json({});

    const processo = doc._source["Número de Processo"] || uuid;
    const filename = processo.replace(/\//g, "-") + ".pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    createReadStream(pdfPath).pipe(res);
});
