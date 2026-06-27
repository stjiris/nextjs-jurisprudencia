import { getElasticSearchClient } from "./elasticsearch";

// Shared request+status store for on-demand full DGSI updates.
// NOTE: the index name and document shape are shared with the clitools-side
// consumer (jurisprudencia-etl/src/consume-trigger.ts). Keep them in sync.
export const ETL_TRIGGER_INDEX = "etl-trigger.0.0";

// Hour of day (server local time) the run is scheduled for.
export const SCHEDULED_HOUR = 19;

export type EtlRunStatus = "scheduled" | "running" | "success" | "failed" | "skipped";

export type EtlRun = {
    scheduledFor: string;   // ISO datetime of the 19:00 slot
    requestedBy: string;
    requestedAt: string;    // ISO datetime of the button press
    status: EtlRunStatus;
    startedAt: string | null;
    endedAt: string | null;
    reportId: string | null;  // link to the jurisprudencia-indexer-report.2.0 doc
    created: number | null;
    updated: number | null;
    deleted: number | null;
    skiped: number | null;
    error: string | null;
};

export type EtlRunWithId = EtlRun & { id: string };

async function getClient() {
    const client = await getElasticSearchClient();
    if (!(await client.indices.exists({ index: ETL_TRIGGER_INDEX }))) {
        await client.indices.create({
            index: ETL_TRIGGER_INDEX,
            mappings: {
                properties: {
                    scheduledFor: { type: "date" },
                    requestedBy: { type: "keyword" },
                    requestedAt: { type: "date" },
                    status: { type: "keyword" },
                    startedAt: { type: "date" },
                    endedAt: { type: "date" },
                    reportId: { type: "keyword" },
                    created: { type: "integer" },
                    updated: { type: "integer" },
                    deleted: { type: "integer" },
                    skiped: { type: "integer" },
                    error: { type: "text" }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0
            }
        }).catch(e => console.log(e));
    }
    return client;
}

export function dateId(d: Date): string {
    // YYYY-MM-DD in server local time -> the per-day idempotency key
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// The next 19:00 slot: today if it's still before 19:00, otherwise tomorrow.
function nextRunSlot(now = new Date()): { id: string; scheduledFor: Date } {
    const scheduledFor = new Date(now);
    scheduledFor.setHours(SCHEDULED_HOUR, 0, 0, 0);
    if (now.getTime() >= scheduledFor.getTime()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
    }
    return { id: dateId(scheduledFor), scheduledFor };
}

// Idempotently schedule a run for the next 19:00 slot. Pressing the button
// again for the same slot returns the existing request without creating a run.
export async function scheduleRun(user: string): Promise<{ run: EtlRunWithId; alreadyScheduled: boolean }> {
    const client = await getClient();
    const { id, scheduledFor } = nextRunSlot();
    const doc: EtlRun = {
        scheduledFor: scheduledFor.toISOString(),
        requestedBy: user,
        requestedAt: new Date().toISOString(),
        status: "scheduled",
        startedAt: null,
        endedAt: null,
        reportId: null,
        created: null,
        updated: null,
        deleted: null,
        skiped: null,
        error: null
    };
    try {
        await client.create({ index: ETL_TRIGGER_INDEX, id, document: doc });
        return { run: { ...doc, id }, alreadyScheduled: false };
    } catch (e: any) {
        if (e?.meta?.statusCode === 409) {
            const existing = await client.get<EtlRun>({ index: ETL_TRIGGER_INDEX, id });
            return { run: { ...(existing._source as EtlRun), id }, alreadyScheduled: true };
        }
        throw e;
    }
}

export async function getLatestRun(): Promise<EtlRunWithId | null> {
    const client = await getClient();
    const r = await client.search<EtlRun>({
        index: ETL_TRIGGER_INDEX,
        size: 1,
        sort: [{ scheduledFor: "desc" }],
        query: { match_all: {} }
    }).catch(() => null);
    if (!r || r.hits.hits.length === 0) return null;
    const hit = r.hits.hits[0];
    return { ...(hit._source as EtlRun), id: hit._id! };
}
