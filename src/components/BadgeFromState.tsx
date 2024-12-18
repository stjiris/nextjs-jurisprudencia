import { JurisprudenciaDocumentStateValue } from "@stjiris/jurisprudencia-document";

export function BadgeFromState({ state }: { state?: JurisprudenciaDocumentStateValue; }) {
    let color = colorFromState(state);
    return <span className={`badge bg-${color}`}>{state || "(estado)"}</span>;
}

export function colorFromState(state?: JurisprudenciaDocumentStateValue) {
    if (state === "público") return "success";
    if (state === "privado") return "warning";
    if (state === "importação") return "info";
    if (state === "preparação") return "info";
    if (state === "eliminado") return "danger";
    return "light";
}