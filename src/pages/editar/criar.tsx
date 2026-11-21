import { withAuthentication } from "@/core/user/authenticate";
import {
    JurisprudenciaDocumentDateKey,
    JurisprudenciaDocumentExactKey,
    JurisprudenciaDocumentGenericKey,
    JurisprudenciaDocumentKey,
    JurisprudenciaDocumentStateKey,
    JurisprudenciaDocumentStateValues,
    JurisprudenciaDocumentTextKey,
    PartialJurisprudenciaDocument,
    isJurisprudenciaDocumentContentKey,
    isJurisprudenciaDocumentDateKey,
    isJurisprudenciaDocumentExactKey,
    isJurisprudenciaDocumentGenericKey,
    isJurisprudenciaDocumentHashKey,
    isJurisprudenciaDocumentObjectKey,
    isJurisprudenciaDocumentStateKey,
    isJurisprudenciaDocumentTextKey
} from "@stjiris/jurisprudencia-document";
import { useContext, useRef, useState } from "react";
import { useRouter } from "next/router";
import { WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { LoggerServerSideProps } from "@/core/logger-api";
import {
    DateInput,
    ExactInput,
    ExactInputWithSuggestions,
    ShowCode,
    ShowGenerated,
    TextInput,
    TextPairInput,
    TokenSelection,
    UpdateContext,
    UpdateObject
} from "@/components/decision/dashboardDoc";
import GenericPage from "@/components/main_pages/genericPageStructure";
import { ParsedDocumentResult } from "@/core/document-file-parser";

export const getServerSideProps = LoggerServerSideProps(withAuthentication<{}>(async () => {
    return { props: {} };
}));

export default function CreatePage() {
    return (
        <GenericPage title="Jurisprudência STJ - Criar Documento">
            <Create />
        </GenericPage>
    );
}

const TEXT_PAIRS: [string, string][] = [
    ["Texto", "Texto Não Anonimizado"],
    ["Sumário", "Sumário Não Anonimizado"],
];

function Create() {
    const keys = useKeysFromContext();
    const [updateObject, setUpdateObject] = useState<UpdateObject>({ STATE: "importação" });
    const [docState, setDocState] = useState<PartialJurisprudenciaDocument>({ STATE: "importação" });
    const [formKey, setFormKey] = useState(0);
    const [importSummary, setImportSummary] = useState<ParsedDocumentResult["summary"] | null>(null);

    const keyMap = Object.fromEntries(keys.keys.map(k => [k.key, k]));
    const activePairs = TEXT_PAIRS.filter(([left]) => keyMap[left]?.editorEnabled);
    const activePairRightKeys = new Set(activePairs.map(([, right]) => right));
    const activePairLeftKeys = new Set(activePairs.map(([left]) => left));
    const hasPairs = activePairs.length > 0;

    const handleParsedDocument = (result: ParsedDocumentResult) => {
        setDocState(result.parsedDoc);
        setUpdateObject(result.parsedDoc);
        setImportSummary(result.summary);
        setFormKey(k => k + 1);
    };

    return (
        <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
            <div className="container-fluid">
                <div className="row">
                    <div className={"card shadow mx-auto " + (hasPairs ? "col-11" : "col-8")}>
                        <div className="card-body">
                            <AcordaoFileDropzone onParsed={handleParsedDocument} />

                            {importSummary && (
                                <div className="alert alert-success d-flex align-items-center justify-content-between mb-3 shadow-sm">
                                    <div>
                                        <div className="d-flex align-items-center mb-1">
                                            <i className="bi bi-check-circle-fill text-success fs-5 me-2"></i>
                                            <strong>Ficheiro importado com sucesso:</strong>
                                            <code className="ms-2">{importSummary.filename}</code>
                                        </div>
                                        <div className="d-flex flex-wrap gap-1 mt-2">
                                            {importSummary.processo && (
                                                <span className="badge bg-primary">Processo: {importSummary.processo}</span>
                                            )}
                                            {importSummary.relator && (
                                                <span className="badge bg-secondary">Relator: {importSummary.relator}</span>
                                            )}
                                            {importSummary.data && (
                                                <span className="badge bg-info text-dark">Data: {importSummary.data}</span>
                                            )}
                                            {importSummary.seccao && (
                                                <span className="badge bg-dark">{importSummary.seccao}</span>
                                            )}
                                            {importSummary.area && (
                                                <span className="badge bg-light text-dark border">{importSummary.area}</span>
                                            )}
                                            {importSummary.decisao && (
                                                <span className="badge bg-warning text-dark">Decisão: {importSummary.decisao}</span>
                                            )}
                                            {importSummary.meioProcessual && (
                                                <span className="badge bg-secondary">Meio: {importSummary.meioProcessual}</span>
                                            )}
                                            {importSummary.temSumario && (
                                                <span className="badge bg-success">Sumário Detetado</span>
                                            )}
                                            <span className="badge bg-light text-dark border">
                                                {importSummary.caracteresTexto} carateres extraídos
                                            </span>
                                            {importSummary.numImagens > 0 && (
                                                <span className="badge bg-primary">
                                                    {importSummary.numImagens} imagem(ns)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close ms-3"
                                        aria-label="Fechar resumo"
                                        onClick={() => setImportSummary(null)}
                                    ></button>
                                </div>
                            )}

                            <CreateDocument docState={docState} />

                            <div key={formKey}>
                                {keys.keys.map((key, i) => {
                                    if (!key.editorEnabled) return null;
                                    if (activePairLeftKeys.has(key.key)) {
                                        const pair = TEXT_PAIRS.find(([left]) => left === key.key)!;
                                        const rightKeyConfig = (keyMap[pair[1]] ?? { key: pair[1], name: pair[1], editorEnabled: true }) as any;
                                        return <TextPairInput key={i} leftKey={key as any} rightKey={rightKeyConfig} doc={docState} />;
                                    }
                                    if (activePairRightKeys.has(key.key)) return null;
                                    return <CreateKey key={i} accessKey={key} doc={docState} />;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </UpdateContext.Provider>
    );
}

function AcordaoFileDropzone({
    onParsed,
    disabled
}: {
    onParsed: (data: ParsedDocumentResult) => void;
    disabled?: boolean;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file) return;
        const validExtensions = [".docx", ".pdf", ".doc"];
        const lowerName = file.name.toLowerCase();
        if (!validExtensions.some(ext => lowerName.endsWith(ext))) {
            setError("Formato de ficheiro não suportado. Por favor utilize um documento .docx ou .pdf.");
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/doc/parse-file", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setError(data?.message || `Falha ao processar ficheiro (HTTP ${res.status})`);
                return;
            }
            onParsed(data as ParsedDocumentResult);
        } catch (err: any) {
            setError(err?.message || "Erro de rede ao enviar ficheiro para análise.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="mb-4">
            <div
                className={`p-4 text-center rounded border-2 ${
                    isDragging ? "border-primary bg-light" : "border-secondary bg-white"
                }`}
                style={{
                    borderStyle: "dashed",
                    cursor: disabled || uploading ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease-in-out",
                    opacity: disabled ? 0.6 : 1
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled && !uploading) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (disabled || uploading) return;
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) handleFile(files[0]);
                }}
                onClick={() => {
                    if (!disabled && !uploading) fileInputRef.current?.click();
                }}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".docx,.pdf,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) handleFile(files[0]);
                    }}
                />
                {uploading ? (
                    <div>
                        <div className="spinner-border text-primary mb-2" role="status"></div>
                        <h6 className="mb-1">A analisar documento...</h6>
                        <small className="text-muted">A extrair metadados, estrutura e texto do acórdão</small>
                    </div>
                ) : (
                    <div>
                        <i className="bi bi-cloud-arrow-up display-5 text-primary mb-2 d-block"></i>
                        <h6 className="mb-1">Importar Acórdão por Ficheiro (.docx / .pdf)</h6>
                        <small className="text-muted d-block">
                            Arraste e largue o ficheiro aqui ou clique para selecionar. O sistema extrai automaticamente o número de processo, relator, data, secção, sumário e texto integral.
                        </small>
                    </div>
                )}
            </div>
            {error && (
                <div className="alert alert-danger py-2 mt-2 d-flex align-items-center justify-content-between">
                    <div>
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {error}
                    </div>
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}
        </div>
    );
}

const AUTO_GENERATED: JurisprudenciaDocumentKey[] = ["Fonte", "CONTENT", "Original", "HASH", "UUID"];

function CreateKey({ accessKey, doc }: { accessKey: JurisprudenciaKey, doc: PartialJurisprudenciaDocument }) {
    if (AUTO_GENERATED.includes(accessKey.key)) return <ShowGenerated accessKey={accessKey} doc={doc} />;
    if (
        isJurisprudenciaDocumentObjectKey(accessKey.key) ||
        isJurisprudenciaDocumentHashKey(accessKey.key) ||
        isJurisprudenciaDocumentContentKey(accessKey.key)
    )
        return <ShowCode accessKey={accessKey} doc={doc} />;
    if (isJurisprudenciaDocumentDateKey(accessKey.key))
        return <DateInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentDateKey }} doc={doc} />;
    if (isJurisprudenciaDocumentTextKey(accessKey.key)) {
        return <TextInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentTextKey }} doc={doc} />;
    }

    if (isJurisprudenciaDocumentGenericKey(accessKey.key)) {
        if (accessKey.editorSuggestions && !accessKey.editorRestricted) {
            return <>&nbsp;</>;
        } else if (accessKey.editorRestricted) {
            return <TokenSelection accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentGenericKey }} doc={doc} />;
        }
        return <>&nbsp;</>;
    }
    if (isJurisprudenciaDocumentExactKey(accessKey.key)) {
        if (accessKey.editorSuggestions) {
            return <ExactInputWithSuggestions accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey }} doc={doc} />;
        }
        return <ExactInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey }} doc={doc} />;
    }
    if (isJurisprudenciaDocumentStateKey(accessKey.key))
        return (
            <ExactInput
                accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentStateKey }}
                doc={doc}
                options={JurisprudenciaDocumentStateValues}
            />
        );

    return <>Unreachable</>;
}

function CreateDocument({ docState }: { docState: PartialJurisprudenciaDocument }) {
    const keys = useKeysFromContext().records;
    const [updateObject] = useContext(UpdateContext);
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const update = async () => {
        setSaving(true);
        try {
            const payload = {
                ...docState,
                ...updateObject,
            };

            const res = await fetch(`${router.basePath}/api/doc`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                alert(`Erro ao criar documento: ${errData.message || res.statusText}`);
                return;
            }
            const writeResponseBase = await res.json() as WriteResponseBase;
            alert("Documento criado com sucesso no Juris!");
            router.push(`/editar/${encodeURIComponent(writeResponseBase._id)}`);
        } catch (e: any) {
            alert(`Erro ao criar documento: ${e?.message || e}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="alert alert-info mb-3">
            <div className="d-flex align-items-center">
                <h5 className="mb-0 flex-shrink-1">
                    Documento <code>(novo)</code>
                </h5>
                <div className="flex-grow-1"></div>
                <div className="btn-group">
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => {
                            if (
                                Object.keys(updateObject).length > 0 &&
                                !confirm("Existem alterações não guardadas. Tem a certeza que pretende voltar?")
                            ) {
                                return;
                            }
                            router.back();
                        }}
                    >
                        Voltar
                    </button>
                    <button
                        className="btn btn-warning"
                        type="button"
                        onClick={() => router.reload()}
                        disabled={Object.keys(updateObject).length === 0 || saving}
                    >
                        Limpar
                    </button>
                    <button
                        className="btn btn-success"
                        type="button"
                        onClick={update}
                        disabled={Object.keys(updateObject).length === 0 || saving}
                    >
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                A criar…
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-1"></i>
                                Guardar Acórdão
                            </>
                        )}
                    </button>
                </div>
            </div>
            {Object.keys(updateObject).length > 0 && (
                <div className="small mt-2 pt-2 border-top">
                    <strong>Campos preenchidos:</strong>{" "}
                    {Object.keys(updateObject)
                        .map(k => keys?.[k as keyof typeof keys]?.name || k)
                        .join(", ")}
                </div>
            )}
        </div>
    );
}
