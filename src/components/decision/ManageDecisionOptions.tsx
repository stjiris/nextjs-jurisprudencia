import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useFetchPost } from "../useFetch";
import { JurisprudenciaKey } from "@/types/keys";
import Link from "next/link";



export default function ManageDecisionOptions(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[] }) {
	const { post: postAnonimizar, loading: loadingAnon } = useFetchPost<{ id: string; doc: JurisprudenciaDocument; jurisUrl?: string; forceOriginal?: boolean }, { ok: boolean; message: string, token?: string }>('/api/anonimizar/enviar');
	const { post: postPublicar, loading: loadingPublicar } = useFetchPost<{ id: string }, { ok: boolean; message?: string }>('/api/gestao/publicar');
	const { post: postTornarPrivado, loading: loadingPrivado } = useFetchPost<{ id: string }, { ok: boolean; message?: string }>('/api/gestao/tornar-privado');

	const anonimizadorUrl = process.env.NEXT_PUBLIC_ANONIMIZADOR_URL;
	const hasOriginal = !!(
		(props.doc["Sumário Não Anonimizado"] && props.doc.Sumário) ||
		(props.doc["Texto Não Anonimizado"] && props.doc.Texto)
	);
	const state = props.doc.STATE;
	const isImportacao = state === "importação";
	const isPreparacao = state === "preparação";
	const isPrivado = state === "privado";
	const isPublico = state === "público";

	const loadingGestao = loadingPublicar || loadingPrivado;

	async function handleAnonimizar(forceOriginal = false) {
		try {
			const result = await postAnonimizar({ id: props.id, doc: props.doc, jurisUrl: window.location.href, forceOriginal });

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

	async function handlePublicar() {
		try {
			const result = await postPublicar({ id: props.id });
			if (!result.ok) {
				alert("Falha ao publicar: " + (result.message || "erro desconhecido"));
				return;
			}
			if (result.message) {
				alert(result.message);
			}
			window.location.reload();
		} catch (err: any) {
			console.error("Publicar error:", err);
			alert("Falha ao publicar: " + (err?.message || "erro desconhecido"));
		}
	}

	async function handleTornarPrivado() {
		try {
			const result = await postTornarPrivado({ id: props.id });
			if (!result.ok) {
				alert("Falha ao tornar privado: " + (result.message || "erro desconhecido"));
				return;
			}
			if (result.message) {
				alert(result.message);
			}
			window.location.reload();
		} catch (err: any) {
			console.error("Tornar privado error:", err);
			alert("Falha ao tornar privado: " + (err?.message || "erro desconhecido"));
		}
	}

	const LABEL_WIDTH = 175;

	return (
		<>
			<div className="d-flex align-items-baseline">
				<b style={{ minWidth: LABEL_WIDTH, flexShrink: 0 }}>Anonimização:</b>
				<span>
					<Link href={`/editar/${encodeURIComponent(props.id)}`}>
						<i className="bi bi-pencil-square me-1"></i>
						Abrir editor
					</Link>

					{anonimizadorUrl && (
						<>
							{" || "}
							<Link href="#"
								className={loadingAnon ? "text-muted" : ""}
								title="Anonimizar"
								onClick={(e) => {
									e.preventDefault();
									if (!loadingAnon) handleAnonimizar(false);
								}}>
								<i className="bi bi-shield-lock me-1"></i>
								{loadingAnon ? "Enviando…" : "Anonimizar"}
							</Link>
							{hasOriginal && (
								<>
									{" || "}
									<Link href="#"
										className={loadingAnon ? "text-muted" : ""}
										title="Anonimizar do original, ignorando a anonimização anterior"
										onClick={(e) => {
											e.preventDefault();
											if (!loadingAnon) handleAnonimizar(true);
										}}>
										<i className="bi bi-shield me-1"></i>
										{loadingAnon ? "Enviando…" : "Anonimizar Original"}
									</Link>
								</>
							)}
						</>
					)}
				</span>
			</div>

			{!isImportacao && (
				<div className="d-flex align-items-baseline">
					<b style={{ minWidth: LABEL_WIDTH, flexShrink: 0 }}>Gestão:</b>
					<span>
						{(isPreparacao || isPrivado) && (
							<Link href="#"
								className={loadingGestao ? "text-muted" : ""}
								title="Publicar documento"
								onClick={(e) => {
									e.preventDefault();
									if (!loadingGestao) handlePublicar();
								}}>
								<i className="bi bi-globe me-1"></i>
								{loadingPublicar ? "A publicar…" : "Publicar"}
							</Link>
						)}
						{(isPreparacao || isPublico) && (
							<>
								{(isPreparacao || isPrivado) && " || "}
								<Link href="#"
									className={loadingGestao ? "text-muted" : ""}
									title="Tornar documento privado"
									onClick={(e) => {
										e.preventDefault();
										if (!loadingGestao) handleTornarPrivado();
									}}>
									<i className="bi bi-lock me-1"></i>
									{loadingPrivado ? "A tornar privado…" : "Tornar Privado"}
								</Link>
							</>
						)}
					</span>
				</div>
			)}
		</>
	);

}