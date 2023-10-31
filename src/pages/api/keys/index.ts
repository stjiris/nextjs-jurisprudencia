import { getAllKeys } from "@/core/keys";
import { authenticatedHandler } from "@/core/user/authenticate";
import { JurisprudenciaKey } from "@/types/keys";

import { NextApiRequest, NextApiResponse } from "next";

export default async function getKeysHandler(
    req: NextApiRequest,
    res: NextApiResponse<JurisprudenciaKey[]>
    ){
    let authed = await authenticatedHandler(req);
    return res.json(await getAllKeys(authed));
}
