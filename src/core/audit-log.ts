import { NextApiRequest } from "next";
import { getElasticSearchClient } from "./elasticsearch";

const AUDIT_INDEX = "audit-log.0.0";

export type AuditAction =
    | "login"
    | "logout"
    | "publicar"
    | "tornar-privado"
    | "restaurar"
    | "editar"
    | "criar"
    | "eliminar"
    | "importar"
    | "exportar";

export interface AuditEvent {
    timestamp: string;
    user: string;
    action: AuditAction;
    documentId?: string;
    documentProcesso?: string;
    details?: string;
    ip?: string;
}

let _ready = false;
async function ensureIndex() {
    const client = await getElasticSearchClient();
    if (!_ready && !(await client.indices.exists({ index: AUDIT_INDEX }))) {
        await client.indices.create({
            index: AUDIT_INDEX,
            mappings: {
                properties: {
                    timestamp: { type: "date" },
                    user: { type: "keyword" },
                    action: { type: "keyword" },
                    documentId: { type: "keyword" },
                    documentProcesso: { type: "keyword" },
                    details: { type: "text" },
                    ip: { type: "ip" },
                },
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
            },
        }).catch(console.error);
    }
    _ready = true;
    return client;
}

export async function logAuditEvent(
    action: AuditAction,
    user: string,
    opts?: {
        documentId?: string | null;
        documentProcesso?: string | null;
        details?: string | null;
        ip?: string | null;
    }
): Promise<void> {
    try {
        const client = await ensureIndex();
        await client.index({
            index: AUDIT_INDEX,
            body: {
                timestamp: new Date().toISOString(),
                user,
                action,
                documentId: opts?.documentId ?? undefined,
                documentProcesso: opts?.documentProcesso ?? undefined,
                details: opts?.details ?? undefined,
                ip: opts?.ip ?? undefined,
            },
        });
    } catch (err) {
        console.error("[audit-log] Failed to log event:", err);
    }
}

export function getUsernameFromReq(req: NextApiRequest): string {
    const userCookie = req.cookies?.user;
    return userCookie || "unknown";
}

export function getIpFromReq(req: NextApiRequest): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
    return req.socket?.remoteAddress || "unknown";
}

export async function queryAuditLog(opts: {
    action?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
}): Promise<{ events: AuditEvent[]; total: number }> {
    const client = await ensureIndex();
    const must: any[] = [];

    if (opts.action) must.push({ term: { action: opts.action } });
    if (opts.user) must.push({ term: { user: opts.user } });
    if (opts.from || opts.to) {
        const range: any = {};
        if (opts.from) range.gte = opts.from;
        if (opts.to) range.lte = opts.to;
        must.push({ range: { timestamp: range } });
    }

    const size = opts.size || 50;
    const from = (opts.page || 0) * size;

    const result = await client.search<AuditEvent>({
        index: AUDIT_INDEX,
        query: must.length > 0 ? { bool: { must } } : { match_all: {} },
        sort: [{ timestamp: { order: "desc" } }],
        from,
        size,
    });

    const events = result.hits.hits
        .filter(h => h._source)
        .map(h => h._source as AuditEvent);

    const total = typeof result.hits.total === "number"
        ? result.hits.total
        : result.hits.total?.value || 0;

    return { events, total };
}
