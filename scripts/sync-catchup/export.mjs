// One-off catch-up, externo side. Run inside clitools_externo.
//
//   node export.mjs            writes sync-catchup.ndjson.gz with every document
//                              changed since the export position, and remembers
//                              the highest _seq_no it covered.
//   node export.mjs --commit   moves the export position to that _seq_no, so the
//                              nightly email export only sends what changed after.
//
// Run --commit only after apply.mjs has finished on interno.
import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs";
import { once } from "events";
import { createGzip } from "zlib";

const INDEX = process.env.INDEX || "jurisprudencia.13.0";
const ES_URL = process.env.ES_URL || "http://localhost:9200";
const AUTH = "Basic " + Buffer.from(`${process.env.ES_USER}:${process.env.ES_PASS}`).toString("base64");
const OUT_FILE = "sync-catchup.ndjson.gz";
const UPTO_FILE = "sync-catchup-upto.json";
const META_URL = "juris-sync-meta/_doc/sync-state";

async function es(method, url, body) {
    const resp = await fetch(`${ES_URL}/${url}`, {
        method,
        headers: { Authorization: AUTH, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(`${method} ${url} failed (${resp.status}): ${JSON.stringify(json)}`);
    return json;
}

async function readPosition() {
    const doc = await es("GET", META_URL);
    if (typeof doc._source?.lastSyncSeqNo !== "number") throw new Error("Export position not found in juris-sync-meta");
    return doc._source.lastSyncSeqNo;
}

async function exportDocs() {
    const since = await readPosition();
    const top = await es("POST", `${INDEX}/_search`, {
        size: 1,
        _source: false,
        seq_no_primary_term: true,
        sort: [{ _seq_no: "desc" }],
        query: { match_all: {} },
    });
    const upto = top.hits.hits[0]?._seq_no;
    if (typeof upto !== "number") throw new Error(`No documents found in ${INDEX}`);
    if (upto <= since) {
        console.log(`Nothing to export: position ${since}, highest _seq_no ${upto}.`);
        return;
    }

    const gzip = createGzip();
    const finished = once(gzip.pipe(createWriteStream(OUT_FILE)), "finish");
    const write = async (obj) => {
        if (!gzip.write(JSON.stringify(obj) + "\n")) await once(gzip, "drain");
    };

    await write({ meta: { index: INDEX, since, upto, createdAt: new Date().toISOString() } });

    let count = 0;
    let searchAfter;
    for (;;) {
        const page = await es("POST", `${INDEX}/_search`, {
            size: 100,
            seq_no_primary_term: true,
            sort: [{ _seq_no: "asc" }],
            query: { range: { _seq_no: { gt: since, lte: upto } } },
            ...(searchAfter ? { search_after: searchAfter } : {}),
        });
        const hits = page.hits.hits;
        if (hits.length === 0) break;
        for (const hit of hits) {
            await write({ id: hit._id, source: hit._source });
            count++;
        }
        searchAfter = hits[hits.length - 1].sort;
        console.log(`Exported ${count}`);
    }

    await write({ end: true, count });
    gzip.end();
    await finished;

    writeFileSync(UPTO_FILE, JSON.stringify({ index: INDEX, since, upto, count }));
    console.log(`Done: ${count} documents, _seq_no ${since} to ${upto}, written to ${OUT_FILE}.`);
}

async function commit() {
    if (!existsSync(UPTO_FILE)) throw new Error(`${UPTO_FILE} not found. Run node export.mjs first.`);
    const { since, upto, count } = JSON.parse(readFileSync(UPTO_FILE, "utf-8"));
    const current = await readPosition();
    if (current !== since) {
        throw new Error(`Export position is ${current}, but the export started from ${since}. Nothing changed.`);
    }
    await es("PUT", `${META_URL}?refresh=true`, { lastSyncSeqNo: upto, lastSyncTimestamp: new Date().toISOString() });
    const pending = await es("POST", `${INDEX}/_count`, { query: { range: { _seq_no: { gt: upto } } } });
    console.log(`Export position moved from ${since} to ${upto} (${count} documents transferred by file).`);
    console.log(`Documents that will go by email at the next export: ${pending.count}.`);
}

(process.argv.includes("--commit") ? commit() : exportDocs()).catch(err => {
    console.error(err);
    process.exit(1);
});
