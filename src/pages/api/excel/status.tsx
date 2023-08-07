import { NextApiRequest, NextApiResponse } from "next";
import { authenticatedHandler } from "@/core/user/authenticate";
import { ExcelState } from "@/types/excel";
import { EXCEL_STATE } from "@/core/excel";

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse<ExcelState>
){
    return res.json(EXCEL_STATE)
}
