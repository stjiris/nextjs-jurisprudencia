import { getAllKeys, getKey } from "@/core/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";

import { NextApiRequest, NextApiResponse } from "next";

export default async function getKeyHandler(
    req: NextApiRequest,
    res: NextApiResponse<JurisprudenciaKey[]>
    ){
    
    return res.json(await getAllKeys());
}
