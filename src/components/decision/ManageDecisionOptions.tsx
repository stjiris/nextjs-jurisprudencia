import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useFetchPost } from "../useFetch";
import { JurisprudenciaKey } from "@/types/keys";
import Link from "next/link";



export default function ManageDecisionOptions(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[] }) {
	const { post, loading, error, response } = useFetchPost<{ id: string; doc: JurisprudenciaDocument }, { ok: boolean; message: string, token?: string }>('/api/anonimizar');

	const anonimizadorUrl = process.env.NEXT_PUBLIC_ANONIMIZADOR_URL;
	async function handleAnonimizar() {
		try {
			const result = await post({ id: props.id, doc: props.doc });

			if (!result.ok) {
				alert("Falha ao anonimizar: " + result.message);
				return;
			}

			if (result.token) {
				const secondAppUrl = `${anonimizadorUrl}/document/${encodeURI(result.token)}`;
				window.open(secondAppUrl, "_blank", "noopener,noreferrer");
			}
		} catch (err: any) {
			console.error("Anonimizar error:", err);
			if (err?.body?.message) {
				alert("Falha ao anonimizar: " + err.body.message);
			} else if (err?.message) {
				alert("Falha ao anonimizar: " + err.message);
			} else {
				alert("Falha ao anonimizar (erro desconhecido)");
			}
		}
	}

	return (
		<>
			<b>Gestão:   </b>
			<Link href={`/editar/${encodeURIComponent(props.id)}`}>
				<i className="bi bi-pencil-square me-1"></i>
				Abrir editor
			</Link>

			{anonimizadorUrl && (
				<>
					{" || "}
					<Link href="#"
						className={loading ? "text-muted" : ""}
						title="Anonimizar"
						onClick={(e) => {
							e.preventDefault();
							if (!loading)
								handleAnonimizar();
						}}>
						<i className="bi bi-shield-lock me-1"></i>
						{loading ? "Enviando…" : "Anonimizar"}
					</Link>
				</>)}
		</>
	);

}