import { NextApiRequest, NextApiResponse } from "next";
import { authenticatedHandler } from "@/core/user/authenticate";
import { ExcelState } from "@/types/excel";
import { EXCEL_STATE } from "@/core/excel";

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse<ExcelState>
){
    if( await authenticatedHandler(req) ){
        return res.json(EXCEL_STATE)
    }
    else{
        return res.status(401).json({export_agg: 1, export_all: 1, import: 1});
    }
}
