// One-off catch-up, interno side. Run inside clitools_interno, from the
// jurisprudencia-privada-etl folder, with this file and sync-merge.mjs copied there.
//
//   node apply.mjs             dry run: reports what would happen, writes nothing
//   node apply.mjs --apply     applies it
//
// Same rules as the email import (sync-merge.mjs). Safe to run again: a document
// already applied just matches by UUID and is overwritten with the same content.
import { createReadStream, writeFileSync } from "fs";
import { createInterface } from "readline";
import { createGunzip } from "zlib";

const { mergeSyncDoc, moveAdoptedFolder, planSyncDoc, reviewEntry, SYNC_REVIEW_INDEX } =
    await import("./sync-merge.mjs").catch(() => import("../../src/core/sync-merge.mjs"));

const IN_FILE = "sync-catchup.ndjson.gz";
const APPLY = process.argv.includes("--apply");
const ES_URL = process.env.ES_URL || "http://localhost:9200";
const AUTH = "Basic " + Buffer.from(`${process.env.ES_USER}:${process.env.ES_PASS}`).toString("base64");

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

const toHit = (h) => ({ id: h._id, source: h._source });

async function main() {
    const lib = APPLY ? await import("@stjiris/filesystem-lib") : null;
    const lines = createInterface({ input: createReadStream(IN_FILE).pipe(createGunzip()), crlfDelay: Infinity });

    const counts = { overwrite: 0, adopt: 0, create: 0, hold: 0, possibleDuplicate: 0 };
    const folders = {};
    const review = [];
    // Searches can lag behind the writes of this same run, so remember them.
    const adoptedIds = new Set();
    const createdByUuid = new Map();

    let index;
    let expected;
    let seen = 0;
    for await (const line of lines) {
        const row = JSON.parse(line);
        if (row.meta) {
            index = row.meta.index;
            console.log(`${APPLY ? "APPLYING" : "DRY RUN"} to ${index}: _seq_no ${row.meta.since} to ${row.meta.upto}`);
            continue;
        }
        if (row.end) {
            expected = row.count;
            continue;
        }

        const incoming = row.source;
        const uuid = incoming.UUID;
        if (!uuid) throw new Error(`Document ${row.id} has no UUID`);

        const uuidResult = await es("POST", `${index}/_search`, { size: 1, query: { term: { UUID: uuid } } });
        const processResult = incoming["Número de Processo"]
            ? await es("POST", `${index}/_search`, { size: 50, query: { term: { "Número de Processo": incoming["Número de Processo"] } } })
            : { hits: { hits: [] } };

        const uuidHit = uuidResult.hits.hits[0]
            ? toHit(uuidResult.hits.hits[0])
            : createdByUuid.has(uuid) ? { id: createdByUuid.get(uuid), source: incoming } : null;
        const processHits = processResult.hits.hits.map(toHit).filter(h => !adoptedIds.has(h.id));

        const plan = planSyncDoc(incoming, uuidHit, processHits);
        counts[plan.action]++;
        if (plan.possibleDuplicate) counts.possibleDuplicate++;

        if (plan.action === "hold" || plan.possibleDuplicate) {
            const entry = reviewEntry(incoming, uuid, plan, processHits);
            const { contentJson, ...summary } = entry;
            review.push(summary);
            if (APPLY) await es("PUT", `${SYNC_REVIEW_INDEX}/_doc/${encodeURIComponent(uuid)}`, entry);
        }

        if (APPLY && plan.action !== "hold") {
            const existing = plan.target?.source;
            const doc = mergeSyncDoc(incoming, existing);
            if (plan.target) {
                await es("PUT", `${index}/_doc/${encodeURIComponent(plan.target.id)}`, doc);
            } else {
                const created = await es("POST", `${index}/_doc`, doc);
                createdByUuid.set(uuid, created._id);
            }
            if (plan.action === "adopt") {
                adoptedIds.add(plan.target.id);
                let result;
                try {
                    result = moveAdoptedFolder(lib, existing, doc);
                } catch (err) {
                    result = "error";
                    console.error(`Could not move the folder for ${uuid}:`, err);
                }
                folders[result] = (folders[result] ?? 0) + 1;
            }
        }

        if (++seen % 500 === 0) console.log(`Processed ${seen}`);
    }

    if (expected !== seen) {
        throw new Error(`The file is incomplete: expected ${expected} documents, read ${seen}. Copy it again.`);
    }
    if (APPLY) await es("POST", `${index}/_refresh`);

    const reportFile = `sync-catchup-report-${APPLY ? "apply" : "dryrun"}.json`;
    writeFileSync(reportFile, JSON.stringify({ counts, folders, review }, null, 2));
    console.log(`\n${APPLY ? "Applied" : "Would apply"} ${seen} documents:`);
    console.log(`  overwrite the existing copy:   ${counts.overwrite}`);
    console.log(`  adopt a SharePoint document:   ${counts.adopt}`);
    console.log(`  create a new document:         ${counts.create}`);
    console.log(`    of which possible duplicates: ${counts.possibleDuplicate}`);
    console.log(`  held for review, not applied:  ${counts.hold}`);
    if (APPLY) console.log(`  folders of adopted documents:  ${JSON.stringify(folders)}`);
    console.log(`Report: ${reportFile}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
