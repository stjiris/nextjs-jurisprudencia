import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useFetchPost } from "../useFetch";
import { JurisprudenciaKey } from "@/types/keys";
import Link from "next/link";



export default function ManageDecisionOptions(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[] }) {
	const { post, loading } = useFetchPost<{ id: string; doc: JurisprudenciaDocument; jurisUrl?: string; forceOriginal?: boolean }, { ok: boolean; message: string, token?: string }>('/api/anonimizar/enviar');

	const anonimizadorUrl = process.env.NEXT_PUBLIC_ANONIMIZADOR_URL;
	const hasOriginal = !!(props.doc["Texto Não Anonimizado"]);
	const state = props.doc.STATE;
	const isImportacao = state === "importação";
	const isPreparacao = state === "preparação";
	const isPrivado = state === "privado";
	const isPublico = state === "público";

	async function handleAnonimizar(forceOriginal = false) {
		try {
			const result = await post({ id: props.id, doc: props.doc, jurisUrl: window.location.href, forceOriginal });

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
			<div>
				<b>Anonimização:   </b>
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
								if (!loading) handleAnonimizar(false);
							}}>
							<i className="bi bi-shield-lock me-1"></i>
							{loading ? "Enviando…" : "Anonimizar"}
						</Link>
						{hasOriginal && (
							<>
								{" || "}
								<Link href="#"
									className={loading ? "text-muted" : ""}
									title="Anonimizar do original, ignorando a anonimização anterior"
									onClick={(e) => {
										e.preventDefault();
										if (!loading) handleAnonimizar(true);
									}}>
									<i className="bi bi-shield me-1"></i>
									{loading ? "Enviando…" : "Anonimizar Original"}
								</Link>
							</>
						)}
					</>
				)}
			</div>

			{!isImportacao && (
				<div>
					<b>Gestão:   </b>
					{(isPreparacao || isPrivado) && (
						<Link href="#" onClick={(e) => e.preventDefault()}>
							<i className="bi bi-globe me-1"></i>
							Publicar
						</Link>
					)}
					{(isPreparacao || isPublico) && (
						<>
							{(isPreparacao || isPrivado) && " || "}
							<Link href="#" onClick={(e) => e.preventDefault()}>
								<i className="bi bi-lock me-1"></i>
								Tornar Privado
							</Link>
						</>
					)}
				</div>
			)}
		</>
	);

}