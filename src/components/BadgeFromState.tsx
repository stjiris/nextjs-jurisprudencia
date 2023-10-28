export function BadgeFromState({ state }: { state?: string; }) {
    let color = "light";
    if (state === "público") color = "primary";
    if (state === "importação") color = "secondary";
    if (state === "preparação") color = "secondary";
    if (state === "eliminado") color = "danger";
    return <div className={`badge bg-${color}`}>{state || "(estado)"}</div>;
}
