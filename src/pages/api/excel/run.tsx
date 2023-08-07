import { EXCEL_FILES_PATH, EXCEL_IMP_PATH, startBuilder, startParser } from "@/core/excel";
import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { isMainThread } from "worker_threads";
import formidable from "formidable";
import { rename } from "fs/promises";
import { join } from "path";

export const config = {
    api: {
        bodyParser: false
    }
}

const form = formidable({
    filter: (part) => part.mimetype ===  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadDir: EXCEL_IMP_PATH,
    keepExtensions: true
});

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    if( !await authenticatedHandler(req) ) return res.status(401).json(false);

    let start = new Date();

    let exclude = Array.isArray(req.query.exclude) ? req.query.exclude : req.query.exclude ? [req.query.exclude] : []
    let doAll = ("doAll" in req.query)
    
    const [fields, files] = await form.parse(req);

    if( "doImport" in fields ){
        let file = Array.isArray(files.import) ? files.import[0] : files.import 
        if( file ){
            let importFile = join(EXCEL_IMP_PATH, `${+start}.xlsx`);
            await rename(file.filepath, importFile) // we can do this on the formidable constructor but I want Date to be exactly the same


            return res.json(startParser(start, exclude))
        }
        else{
            return res.status(400).json(false) // Imported not an excel file
        }
    }
    else{
        return res.json(startBuilder(start, exclude, doAll))
    }
    
}