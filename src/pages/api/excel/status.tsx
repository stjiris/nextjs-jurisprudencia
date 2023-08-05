import { NextApiRequest, NextApiResponse } from "next";
import { authenticatedHandler } from "@/core/user/authenticate";
import { ExcelState } from "@/types/excel";
import { EXCEL_STATE } from "@/core/excel";

async function getState(): Promise<ExcelState>{
    return {
        export: EXCEL_STATE.export,
        import: null
    }
}

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse<ExcelState>
){
    if( await authenticatedHandler(req) ){
        return res.json(await getState())
    }
    else{
        return res.status(401).json({export: 1, import: 1});
    }
}
