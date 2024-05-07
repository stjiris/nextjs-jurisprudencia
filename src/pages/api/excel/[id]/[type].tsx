import { EXCEL_FILES_PATH } from "@/core/excel";
import LoggerApi from "@/core/logger-api";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

import { NextApiRequest, NextApiResponse } from "next";
import { join } from "path";

export default LoggerApi(async function getExcelHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    let id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id!;
    let type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type!;

    let filePath = join(EXCEL_FILES_PATH, type, `${id}.xlsx`);
    let stats = await stat(filePath).catch(e => null);
    if( !stats ) return res.status(404).end()
    let size = stats.size;

    return new Promise(resolve => {
        res.writeHead(200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Length': size
        });
        let rs = createReadStream(filePath)
    
        rs.pipe(res)
        rs.on("end", resolve)
    })
});
