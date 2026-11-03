// Run with: node --test scripts/sync-catchup/
import test from "node:test";
import assert from "node:assert/strict";
import { DGSI_FONTE, SHAREPOINT_FONTE, mergeSyncDoc, planSyncDoc } from "../../src/core/sync-merge.mjs";

const dgsi = (over = {}) => ({ Fonte: DGSI_FONTE, UUID: "new", URL: "http://dgsi/1", "Número de Processo": "1/20", Data: "01/02/2026", STATE: "público", ...over });
const sp = (id, over = {}) => ({ id, source: { Fonte: SHAREPOINT_FONTE, UUID: id, URL: `sp/${id}`, "Número de Processo": "1/20", Data: "01/02/2026", STATE: "importação", ...over } });

test("same UUID on a DGSI document overwrites", () => {
    const hit = { id: "a", source: dgsi({ UUID: "same" }) };
    assert.equal(planSyncDoc(dgsi({ UUID: "same" }), hit, [hit]).action, "overwrite");
});

test("same URL overwrites even if the UUID changed", () => {
    const hit = { id: "a", source: dgsi({ UUID: "old" }) };
    const plan = planSyncDoc(dgsi(), null, [hit]);
    assert.equal(plan.action, "overwrite");
    assert.equal(plan.target.id, "a");
});

test("SharePoint document with the same process and date is adopted despite a different UUID", () => {
    const hit = sp("a");
    const plan = planSyncDoc(dgsi(), null, [hit]);
    assert.equal(plan.action, "adopt");
    assert.equal(plan.target.id, "a");
});

for (const STATE of ["importação", "preparação", "privado", "eliminado", "público"]) {
    test(`SharePoint document in ${STATE} is adopted, by process match and by UUID`, () => {
        const hit = sp("a", { STATE });
        assert.equal(planSyncDoc(dgsi(), null, [hit]).action, "adopt");
        assert.equal(planSyncDoc(dgsi(), hit, [hit]).action, "adopt");
    });
}

test("adoption takes externo's STATE, so interno shows the finished work", () => {
    assert.equal(mergeSyncDoc(dgsi(), sp("a", { STATE: "preparação" }).source).STATE, "público");
});

test("same process with a different date creates and flags, never overwrites", () => {
    const plan = planSyncDoc(dgsi(), null, [sp("a", { Data: "05/05/2025" })]);
    assert.equal(plan.action, "create");
    assert.equal(plan.possibleDuplicate, true);
    assert.equal(plan.target, undefined);
});

test("several SharePoint documents for the same process and date are held", () => {
    const plan = planSyncDoc(dgsi(), null, [sp("a"), sp("b")]);
    assert.deepEqual(plan, { action: "hold", reason: "several-candidates" });
});

test("another DGSI decision in the same process creates without a flag", () => {
    const other = { id: "a", source: dgsi({ UUID: "other", URL: "http://dgsi/2" }) };
    assert.deepEqual(planSyncDoc(dgsi(), null, [other]), { action: "create", possibleDuplicate: false });
});

test("no match creates", () => {
    assert.deepEqual(planSyncDoc(dgsi(), null, []), { action: "create", possibleDuplicate: false });
});

test("merge keeps interno-only text and its hashes", () => {
    const existing = {
        "Texto Não Anonimizado": "<p>nomes</p>",
        "Sumário Não Anonimizado": "<p>sumário</p>",
        ENTITIES: { PER: ["X"] },
        HASH: { Texto: "old", "Texto Não Anonimizado": "hashT", "Sumário Não Anonimizado": "hashS" },
    };
    const doc = mergeSyncDoc(dgsi({ Texto: "anon", HASH: { Texto: "new", "Texto Não Anonimizado": "empty", "Sumário Não Anonimizado": "empty" } }), existing);
    assert.equal(doc["Texto Não Anonimizado"], "<p>nomes</p>");
    assert.equal(doc["Sumário Não Anonimizado"], "<p>sumário</p>");
    assert.deepEqual(doc.ENTITIES, { PER: ["X"] });
    assert.equal(doc.Texto, "anon");
    assert.deepEqual(doc.HASH, { Texto: "new", "Texto Não Anonimizado": "hashT", "Sumário Não Anonimizado": "hashS" });
});

test("merge takes externo's Original when it has one, and keeps interno's otherwise", () => {
    assert.deepEqual(mergeSyncDoc(dgsi({ Original: { a: "x" } }), { Original: { a: "y" } }).Original, { a: "x" });
    assert.deepEqual(mergeSyncDoc(dgsi(), { Original: { a: "y" } }).Original, { a: "y" });
});

test("merge unions CONTENT without duplicates", () => {
    assert.deepEqual(mergeSyncDoc(dgsi({ CONTENT: ["b", "c"] }), { CONTENT: ["a", "b"] }).CONTENT, ["a", "b", "c"]);
    assert.deepEqual(mergeSyncDoc(dgsi(), { CONTENT: ["a"] }).CONTENT, ["a"]);
});

test("merge respects externo's STATE and defaults to público", () => {
    assert.equal(mergeSyncDoc(dgsi({ STATE: "privado" }), { STATE: "público" }).STATE, "privado");
    assert.equal(mergeSyncDoc(dgsi({ STATE: undefined }), null).STATE, "público");
});
