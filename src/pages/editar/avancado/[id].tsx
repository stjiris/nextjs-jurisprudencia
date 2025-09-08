//@ts-nocheck
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateValues, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { useContext, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { UpdateObject, DateInput, TextInput, UpdateContext, ExactInput, GenericInput, GenericInputOriginalOnly, ShowCode } from "@/components/dashboardDoc";
import { Loading } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { GetResponse, WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { useKeysFromContext } from "@/contexts/keys";
import { LoggerServerSideProps } from "@/core/logger-api";

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
})

interface UpdateProps {
    id: string
    doc: JurisprudenciaDocument
}

// Blocos de edição para arrays (Mostrar ou Índice)
function ChipsCell({ value, onChange, suggestions, fetchSuggestions, fieldName }) {
    const [chips, setChips] = useState(value || []);
    const [editingIdx, setEditingIdx] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [suggestionsList, setSuggestionsList] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [pendingChipValue, setPendingChipValue] = useState("");
    const [pendingChipIndex, setPendingChipIndex] = useState(null);
    const [similarSuggestion, setSimilarSuggestion] = useState("");
    const router = useRouter();

    useEffect(() => { setChips(value || []); }, [value]);
    useEffect(() => { if (editingIdx !== null && fetchSuggestions) fetchSuggestions().then(setSuggestionsList); }, [editingIdx]);


    function normalize(str) {
        return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    }

    // Sugestão de termo semelhantes
    function findSimilarSuggestion(value, suggestions) {
        if (!value || !suggestions || suggestions.length === 0) return "";
        
        const normalizedValue = normalize(value);
        let bestMatch = "";
        let bestScore = Infinity;
        
        for (const suggestion of suggestions) {
            const normSuggestion = normalize(suggestion);
            // Não verificar se o termo existe só parcialmente na lista de sugestões
            if (normSuggestion.includes(normalizedValue)) continue;
            const distance = levenshteinDistance(normalizedValue, normSuggestion);
            if (distance < bestScore) {
                bestScore = distance;
                bestMatch = suggestion;
            }
        } 
        
        // Sugestão se o termo for superior a 85% de similaridade
        const maxDistance = Math.max(normalizedValue.length, normalize(bestMatch).length) * 0.85;
        return bestScore > 0 && bestScore <= maxDistance ? bestMatch : "";
    }

    // Levenshtein distance 
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    const startEditChip = (idx) => { setEditingIdx(idx); setEditValue(chips[idx]); setSuggestionsOpen(true); };
    
    const saveEditChip = (idx) => {
        const trimmedValue = editValue.trim();
        
        if (trimmedValue === "") {
            let newChips = chips.slice();
            newChips.splice(idx, 1);
            setChips(newChips);
            setEditingIdx(null);
            setEditValue("");
            setSuggestionsOpen(false);
            onChange(newChips);
            return;
        }
        
        // Verifica se o termo existe na lista de sugestões
        const existsInSuggestions = suggestionsList.some(s => normalize(s) === normalize(trimmedValue));
        
        if (!existsInSuggestions && suggestionsList.length > 0) {
            // Warning prompt
            setPendingChipValue(trimmedValue);
            setPendingChipIndex(idx);
            setSimilarSuggestion(findSimilarSuggestion(trimmedValue, suggestionsList));
            setShowWarningModal(true);
            return;
        }
        
        // Proceed with saving
        let newChips = chips.slice();
        newChips[idx] = trimmedValue;
        setChips(newChips);
        setEditingIdx(null);
        setEditValue("");
        setSuggestionsOpen(false);
        onChange(newChips);
    };
    
    const confirmSaveChip = () => {
        let newChips = chips.slice();
        newChips[pendingChipIndex] = pendingChipValue;
        setChips(newChips);
        setEditingIdx(null);
        setEditValue("");
        setSuggestionsOpen(false);
        onChange(newChips);
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setSimilarSuggestion("");
    };
    
    const useSuggestedChip = () => {
        let newChips = chips.slice();
        newChips[pendingChipIndex] = similarSuggestion;
        setChips(newChips);
        setEditingIdx(null);
        setEditValue("");
        setSuggestionsOpen(false);
        onChange(newChips);
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setSimilarSuggestion("");
    };
    
    const cancelSaveChip = () => {
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setSimilarSuggestion("");
    };
    
    const cancelEditChip = () => { setEditingIdx(null); setEditValue(""); setSuggestionsOpen(false); };
    const addChip = () => { setChips([...chips, ""]); setEditingIdx(chips.length); setEditValue(""); setSuggestionsOpen(true); };
    const removeChip = (idx) => { let newChips = chips.filter((_, i) => i !== idx); setChips(newChips); onChange(newChips); };
    
    // Só mostrar sugestões se pelo menos 1 caractere foi digitado e só mostrar sugestões que começam com o valor digitado (sem acentuação)
    const filteredSuggestions = (editValue && editValue.length > 0)
        ? suggestionsList.filter(s => normalize(s).startsWith(normalize(editValue)) && !chips.includes(s))
        : [];

    return (
        <>
            <div className="chips-box position-relative">
                {chips.map((chip, idx) => (
                    <span className="chip" key={idx}>
                        {editingIdx === idx ? (
                            <>
                                <input
                                    className="chip-edit-input"
                                    value={editValue}
                                    autoFocus
                                    onChange={e => { setEditValue(e.target.value); setSuggestionsOpen(true); }}
                                    onBlur={() => saveEditChip(idx)}
                                    onKeyDown={e => { if (e.key === "Enter") saveEditChip(idx); if (e.key === "Escape") cancelEditChip(); }}
                                />
                                {suggestionsOpen && filteredSuggestions.length > 0 && (
                                    <ul className="suggestions-list">
                                        {filteredSuggestions.map((s, i) => (
                                            <li key={i} onMouseDown={() => { setEditValue(s); setSuggestionsOpen(false); setTimeout(() => saveEditChip(idx), 0); }}>{s}</li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        ) : (
                            <span onClick={() => startEditChip(idx)} style={{cursor:'pointer'}}>{chip}</span>
                        )}
                        <button type="button" className="chip-remove" onClick={() => removeChip(idx)}>&times;</button>
                    </span>
                ))}
                <button type="button" className="chip-add" onClick={addChip}>+</button>
            </div>
            
            {/* Warning Modal */}
            {showWarningModal && (
                <div className="modal show" tabIndex={-1} style={{
                    display: 'block',
                    background: 'rgba(0,0,0,0.4)',
                    zIndex: 1050
                }}>
                    <div className="modal-dialog modal-dialog-centered" style={{maxWidth: 400}}>
                        <div className="modal-content" style={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            background: '#ffffff'
                        }}>
                            <div className="modal-body" style={{padding: '1.5rem', textAlign: 'center'}}>
                                <div style={{
                                    fontSize: '1rem', 
                                    color: '#374151', 
                                    marginBottom: '1rem',
                                    lineHeight: 1.5
                                }}>
                                    O termo <strong>{pendingChipValue}</strong> não existe na lista de sugestões para <strong>{fieldName}</strong>.
                                </div>
                                {similarSuggestion && (
                                    <div style={{
                                        fontSize: '0.9rem', 
                                        color: '#1f2937', 
                                        marginBottom: '1.5rem',
                                        padding: '0.75rem',
                                        background: '#f3f4f6',
                                        borderRadius: 6,
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        Sugestão de termo semelhante detectado: <strong>{similarSuggestion}</strong>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer" style={{
                                border: 'none', 
                                justifyContent: 'center', 
                                gap: 8, 
                                padding: '0 1.5rem 1.5rem 1.5rem'
                            }}>
                                <button className="btn btn-outline-secondary" style={{
                                    borderRadius: 6,
                                    padding: '8px 16px',
                                    fontSize: '0.9rem'
                                }} onClick={cancelSaveChip}>
                                    Cancelar
                                </button>
                                {similarSuggestion && (
                                    <button className="btn btn-primary" style={{
                                        borderRadius: 6,
                                        padding: '8px 16px',
                                        fontSize: '0.9rem'
                                    }} onClick={useSuggestedChip}>
                                        Usar Sugestão
                                    </button>
                                )}
                                <button className="btn btn-warning" style={{
                                    borderRadius: 6,
                                    padding: '8px 16px',
                                    fontSize: '0.9rem'
                                }} onClick={confirmSaveChip}>
                                    Criar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx>{`
                .chips-box {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5em;
                    background: #f8fafc;
                    border: 1.5px solid #d0d7de;
                    border-radius: 8px;
                    padding: 0.5em;
                    min-height: 48px;
                }
                .chip {
                    display: inline-flex;
                    align-items: center;
                    background: #e3f2fd;
                    color: #000000;
                    border-radius: 16px;
                    padding: 0.25em 0.75em;
                    font-size: 1em;
                    font-weight: 500;
                }
                .chip-remove {
                    background: none;
                    border: none;
                    color: #1976d2;
                    font-size: 1.2em;
                    margin-left: 0.5em;
                    cursor: pointer;
                }
                .chip-add {
                    background: #1976d2;
                    color: #fff;
                    border: none;
                    border-radius: 50%;
                    width: 2em;
                    height: 2em;
                    font-size: 1.3em;
                    margin-left: 0.5em;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .chip-edit-input {
                    border: none;
                    outline: none;
                    font-size: 1em;
                    background: #fff;
                    min-width: 80px;
                    margin-right: 0.5em;
                }
                .suggestions-list {
                    position: absolute;
                    left: 0;
                    top: 100%;
                    z-index: 10;
                    background: #fff;
                    border: 1px solid #1976d2;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px #1976d255;
                    list-style: none;
                    margin: 0;
                    padding: 0.25em 0;
                    min-width: 180px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .suggestions-list li {
                    padding: 0.4em 1em;
                    cursor: pointer;
                    color: #000000;
                    font-weight: 500;
                }
                .suggestions-list li:hover {
                    background: #e3f2fd;
                }
            `}</style>
        </>
    );
}

export default function UpdatePage() {
    let searchParams = useSearchParams();
    let id = searchParams.get("id");
    let response = useFetch<GetResponse<JurisprudenciaDocument>>(`/api/doc/${id}`, [id]);

    return <DashboardGenericPage title="Jurisprudência STJ - Editar Documento">
        {response && response._source && <Update doc={response._source} id={id} />}
        {!response && <Loading text="A carregar documento" />}
        {response && !response._source && <div className="alert alert-danger">
            <h3>Erro ao carregar o documento</h3>
        </div>}
    </DashboardGenericPage>
}

function Update({ doc, id }: UpdateProps) {
    let keys = useKeysFromContext();
    let [updateObject, setUpdateObject] = useState<UpdateObject>({});
    const editableKeys = keys.keys.filter(key => key.editorEnabled);
    const [focusedKey, setFocusedKey] = useState(null);
    const [showToast, setShowToast] = useState(false);
    const formRef = useRef(null);

    // Group generic keys for the new layout
    const genericKeys = editableKeys.filter(key => isJurisprudenciaDocumentGenericKey(key.key));
    const nonGenericKeys = editableKeys.filter(key => !isJurisprudenciaDocumentGenericKey(key.key));

    // Scroll to top button logic
    const [showScroll, setShowScroll] = useState(false);
    useEffect(() => {
        const onScroll = () => setShowScroll(window.scrollY > 200);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    // Helper to fetch suggestions for a field and type
    function fetchSuggestions(fieldKey, type) {
        return fetch(`/api/datalist?agg=${encodeURIComponent(fieldKey)}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => data.map(d => d.key));
    }

    return <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
        <div className="sticky-action-bar shadow-sm bg-white border-bottom py-2 px-3 d-flex flex-column align-items-center justify-content-center">
            <div className="d-flex flex-column align-items-center w-100">
                <span className="fw-bold fs-4 mb-2">Documento <code>{id}</code></span>
                <ActionButtons id={id} updateObject={updateObject} setShowToast={setShowToast} />
            </div>
        </div>
        {showToast && <div className="toast show position-fixed top-0 end-0 m-4 bg-success text-white" style={{zIndex:2000}}>
            <div className="toast-body">Guardado com sucesso!</div>
        </div>}
        {showScroll && <button className="btn btn-light shadow rounded-circle position-fixed" style={{bottom:30,right:30,zIndex:2000}} onClick={scrollToTop}><i className="bi bi-arrow-up"></i></button>}
        <div className="container-fluid py-4" ref={formRef}>
            <div className="row justify-content-center mb-4">
                <div className="col-12 col-md-8">
                    <div className="card shadow-sm">
                        <div className="card-header bg-light border-bottom text-center">
                            <h5 className="mb-0">Original {doc.URL && <>- <Link target="_blank" href={doc.URL}>{doc.Fonte}</Link></>}</h5>
                        </div>
                        <div className="card-body">
                    <ShowOriginal original={doc.Original || {}} />
                        </div>
                    </div>
                </div>
            </div>
            {/* Opções de edição */}
            <div className="row justify-content-center">
            <div className="col-12 col-md-8">
                    <div className="card shadow-sm">
                        <div className="card-header bg-primary text-white">
                            <h4 className="mb-0">Edição de Acórdão</h4>
                        </div>
                    <div className="card-body">
                        {genericKeys.length > 0 && (
                            <div className="mb-4">
                                <div className="row mb-1"> 
                                    <div className="col-12 col-md-6 text-center">
                                        <div className="panel-header panel-header-large dark-blue">Mostrar</div>
                                    </div>
                                    <div className="col-12 col-md-6 text-center">
                                        <div className="panel-header panel-header-large dark-blue">Índice</div>
                                    </div>
                                </div>
                                <div className="row">
                                    {genericKeys.map((key, i) => {
                                        const value = doc[key.key] || { Show: [], Index: [] };
                                        const updated = updateObject[key.key];
                                        // Detect if edited (either Show or Index changed)
                                        let hasChanged = false;
                                        if (updated) {
                                            if (
                                                (updated.Show && value.Show && updated.Show.join('\n') !== value.Show.join('\n')) ||
                                                (updated.Index && value.Index && updated.Index.join('\n') !== value.Index.join('\n')) ||
                                                (updated.Show && !value.Show) || (updated.Index && !value.Index)
                                            ) {
                                                hasChanged = true;
                                            }
                                        }
                                        return (
                                            <div className="col-12 mb-4" key={key.key + '-unified'}>
                                                <div className="metadata-box">
                                                    <div className="metadata-label mb-3 d-flex align-items-center">
                                                        {key.name}
                                                        {hasChanged && (
                                                            <span className="edit-dot ms-2" title="Alterado"><i className="bi bi-pencil-square"></i></span>
                                                        )}
                                                    </div>
                                                    <div className="row">
                                                        <div className="col-12 col-md-6 mb-3 mb-md-0">
                                                            <ChipsCell
                                                                value={value.Show}
                                                                onChange={chips => setUpdateObject(old => ({ ...old, [key.key]: { ...value, Show: chips } }))}
                                                                fetchSuggestions={() => fetchSuggestions(key.key, "Show")}
                                                                fieldName={`${key.name} (Mostrar)`}
                                                            />
                                                        </div>
                                                        <div className="col-12 col-md-6">
                                                            <ChipsCell
                                                                value={value.Index}
                                                                onChange={chips => setUpdateObject(old => ({ ...old, [key.key]: { ...value, Index: chips } }))}
                                                                fetchSuggestions={() => fetchSuggestions(key.key, "Index")}
                                                                fieldName={`${key.name} (Índice)`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* Render non-generic fields as before */}
                        <div className="row g-3">
                            {nonGenericKeys.length === 0 && <div className="text-muted">Nenhum campo editável.</div>}
                            {nonGenericKeys.map((key, i) => (
                                <div className="col-12" key={i}>
                                    <FieldEditRow accessKey={key} doc={doc} updateObject={updateObject} focusedKey={focusedKey} setFocusedKey={setFocusedKey} />
                                </div>
                            ))}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
        <style jsx>{`
            .sticky-action-bar { position: sticky; top: 0; z-index: 100; }
            .card { border-radius: 12px; }
            .card-header { border-radius: 12px 12px 0 0; }
            .card-body { border-radius: 0 0 12px 12px; }
            .field-focused { box-shadow: 0 0 0 2px #2196f3; border-color: #2196f3 !important; }
            .field-focused-editing { border: 4px solid #00b0ff !important; box-shadow: 0 0 0 10px #2196f3, 0 0 12px #00b0ffcc; }
            .alterado-badge-editing { background: #00b0ff; color: #fff; border-radius: 50%; padding: 0.2em 0.5em; font-size: 1em; margin-left: 0.5em; box-shadow: 0 0 8px #00b0ff99; }
            .sticky-action-bar .btn-group { justify-content: center; width: 100%; }
            .panel-header { font-size: 1.2em; padding-bottom: 0.25em; margin-bottom: 0.2em; }
            .panel-header-large { font-size: 2em; font-weight: bold; text-align: center; margin-bottom: 0.2em; letter-spacing: 0.03em; }
            .dark-blue { color:rgb(0, 0, 0); }
            .metadata-box { background: #f8fafc; border: 1.5px solid #d0d7de; border-radius: 12px; padding: 1.5em 1.5em 1em 1.5em; }
            .metadata-label { font-weight: 700; font-size: 1.25em; letter-spacing: 0.01em; color: #000000; }
            .chips-section-label { font-size: 1.1em; font-weight: 600; color:rgb(0, 0, 0); }
            .alterado-badge-editing { background: #00b0ff; color: #fff; border-radius: 50%; padding: 0.2em 0.5em; font-size: 1em; margin-left: 0.5em; box-shadow: 0 0 8px #00b0ff99; display: inline-flex; align-items: center; }
            .edit-dot { display: inline-block; margin-left: 0.5em; vertical-align: middle; }
        `}</style>
    </UpdateContext.Provider>;
}

function FieldEditRow({ accessKey, doc, updateObject, focusedKey, setFocusedKey }) {
    const original = doc[accessKey.key];
    const current = updateObject[accessKey.key];
    let hasChanged = false;
    function normalizeHtml(str) {
        if (!str) return '';
        return str.replace(/<p><br><\/p>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
    }
    if (typeof original === 'string' && typeof current === 'string') {
        if (/<[a-z][\s\S]*>/i.test(original) || /<[a-z][\s\S]*>/i.test(current)) {
            hasChanged = normalizeHtml(original) !== normalizeHtml(current);
        } else {
            hasChanged = original.trim() !== current.trim();
        }
    } else if (Array.isArray(original) && Array.isArray(current)) {
        hasChanged = original.map(x=>x.trim()).join('\n') !== current.map(x=>x.trim()).join('\n');
    } else if (typeof original === 'object' && typeof current === 'object' && original && current) {
        hasChanged = (original.Show?.join('\n').trim() !== current.Show?.join('\n').trim()) || (original.Index?.join('\n').trim() !== current.Index?.join('\n').trim());
    } else if (current !== undefined) {
        hasChanged = true;
    }
    return (
        <div className={`p-2 border rounded position-relative bg-white ${hasChanged ? 'field-focused-editing' : 'border-light'}`}> 
            <div className="d-flex align-items-center mb-1">
                <span className="fw-semibold me-2">{accessKey.name}</span>
                {/*'Alterado' icon quando o valor foi alterado*/}
                {hasChanged && <span className="alterado-badge-editing" title="Alterado"><i className="bi bi-pencil-square"></i></span>}
            </div>
            <EditKey accessKey={accessKey} doc={doc} onFocus={() => setFocusedKey(accessKey.key)} onBlur={() => setFocusedKey(null)} />
        </div>
    );
}

function ActionButtons({ id, updateObject, setShowToast }) {
    const router = useRouter();
    const navRouter = useNavRouter();
    const update = async () => {
        await fetch(`${router.basePath}/api/doc/${id}`, {
            method: "PUT",
            body: JSON.stringify(updateObject)
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        navRouter.refresh();
    }
    const deleteDoc = async () => {
        if (!confirm("Tem a certeza que quer eliminar o documento?")) return;
        let writeResponseBase = await fetch(`${router.basePath}/api/doc/${id}`, {
            method: "DELETE",
        }).then(r => r.json() as Promise<WriteResponseBase>);
        if (writeResponseBase.result === "updated") {
            navRouter.refresh();
        }
        else {
            navRouter.push("/admin/")
        }
    }
    return (
        <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => navRouter.back()}>Voltar</button>
            <button className="btn btn-danger" onClick={deleteDoc} disabled={Object.keys(updateObject).length > 0}>Eliminar</button>
            <button className="btn btn-warning" onClick={() => navRouter.refresh()} disabled={Object.keys(updateObject).length === 0}>Cancelar</button>
            <button className="btn btn-success" onClick={update} disabled={Object.keys(updateObject).length === 0}>Guardar</button>
        </div>
    );
}

function ShowOriginal({ original }: { original: Record<string, any> }) {
    return <table className="table table-sm">
        <tbody>
            {Object.entries(original).map(([accessKey, obj], i) => obj.length > 1200 ?
                <tr key={i}>
                    <td colSpan={2}>
                        <details>
                            <summary>{accessKey}</summary>
                            <div dangerouslySetInnerHTML={{ __html: obj }}></div>
                        </details>
                    </td>
                </tr>
                :
                <tr key={i}>
                    <td>{accessKey}</td>
                    <td dangerouslySetInnerHTML={{ __html: obj }}></td>
                </tr>
            )}
        </tbody>
    </table>
}

function EditKey({ accessKey, doc, onFocus, onBlur }: { accessKey: any, doc: PartialJurisprudenciaDocument, onFocus?: ()=>void, onBlur?: ()=>void }) {
    if (isJurisprudenciaDocumentObjectKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentHashKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentContentKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentTextKey(accessKey.key)) return <TextInput accessKey={accessKey} doc={doc} onFocus={onFocus} onBlur={onBlur} />
    if (isJurisprudenciaDocumentDateKey(accessKey.key)) return <DateInput accessKey={accessKey} doc={doc} onFocus={onFocus} onBlur={onBlur} />
    if (isJurisprudenciaDocumentStateKey(accessKey.key)) return <ExactInput accessKey={accessKey} doc={doc} options={JurisprudenciaDocumentStateValues} onFocus={onFocus} onBlur={onBlur} />
    if (isJurisprudenciaDocumentExactKey(accessKey.key)) return <ExactInput accessKey={accessKey} doc={doc} onFocus={onFocus} onBlur={onBlur} />
    if (isJurisprudenciaDocumentGenericKey(accessKey.key)) {
        return <GenericIndexMostrarInput accessKey={accessKey} doc={doc} onFocus={onFocus} onBlur={onBlur} />
    }
    return <>Unreachable</>
}


function GenericIndexMostrarInput({ accessKey, doc, onFocus, onBlur, indexOnly }: { accessKey: any, doc: PartialJurisprudenciaDocument, onFocus?: ()=>void, onBlur?: ()=>void, indexOnly?: boolean }) {
    const [, setUpdateObject] = useContext(UpdateContext);
    const initialValue = doc[accessKey.key] || { Index: [], Show: [] };
    const [showChips, setShowChips] = useState(initialValue.Show || []);
    const [indexChips, setIndexChips] = useState(initialValue.Index || []);
    const [editingShowIdx, setEditingShowIdx] = useState(null);
    const [editingIndexIdx, setEditingIndexIdx] = useState(null);
    const [showEditValue, setShowEditValue] = useState("");
    const [indexEditValue, setIndexEditValue] = useState("");
    const [showSuggestions, setShowSuggestions] = useState([]);
    const [indexSuggestions, setIndexSuggestions] = useState([]);
    const [showSuggestionsOpen, setShowSuggestionsOpen] = useState(false);
    const [indexSuggestionsOpen, setIndexSuggestionsOpen] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [pendingChipValue, setPendingChipValue] = useState("");
    const [pendingChipIndex, setPendingChipIndex] = useState(null);
    const [pendingChipType, setPendingChipType] = useState(""); // "show" or "index"
    const [similarSuggestion, setSimilarSuggestion] = useState("");
    const router = useRouter();

    function normalize(str) {
        return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    }

    function findSimilarSuggestion(value, suggestions) {
        if (!value || !suggestions || suggestions.length === 0) return "";
        
        const normalizedValue = normalize(value);
        
        let bestMatch = "";
        let bestScore = Infinity;
        
        for (const suggestion of suggestions) {
            const normSuggestion = normalize(suggestion);
            if (normSuggestion.includes(normalizedValue)) continue;
            const distance = levenshteinDistance(normalizedValue, normSuggestion);
            if (distance < bestScore) {
                bestScore = distance;
                bestMatch = suggestion;
            }
        }
        
        const maxDistance = Math.max(normalizedValue.length, normalize(bestMatch).length) * 0.7;
        return bestScore > 0 && bestScore <= maxDistance ? bestMatch : "";
    }

    // Levenshtein distance function
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

 
    function getAggKey(fieldKey, type) {

        return fieldKey;
    }
    
    const aggKeyShow = getAggKey(accessKey.key, "Show");
    const aggKeyIndex = getAggKey(accessKey.key, "Index");

    // Fetch suggestions for Mostrar
    useEffect(() => {
        if (editingShowIdx === null) return;
        fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(aggKeyShow)}`)
            .then(r => {
                if (!r.ok) {
                    console.error(`Failed to fetch suggestions for ${aggKeyShow}:`, r.status);
                    return [];
                }
                return r.json();
            })
            .then(data => {
                setShowSuggestions(data.map(d => d.key));
            })
            .catch(err => {
                console.error(`Error fetching suggestions for ${aggKeyShow}:`, err);
                setShowSuggestions([]);
            });
    }, [editingShowIdx, aggKeyShow]);
    
    // Fetch suggestions for Índice
    useEffect(() => {
        if (editingIndexIdx === null) return;
        fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(aggKeyIndex)}`)
            .then(r => {
                if (!r.ok) {
                    console.error(`Failed to fetch suggestions for ${aggKeyIndex}:`, r.status);
                    return [];
                }
                return r.json();
            })
            .then(data => {
                setIndexSuggestions(data.map(d => d.key));
            })
            .catch(err => {
                console.error(`Error fetching suggestions for ${aggKeyIndex}:`, err);
                setIndexSuggestions([]);
            });
    }, [editingIndexIdx, aggKeyIndex]);

    const startEditShowChip = (idx) => {
        setEditingShowIdx(idx);
        setShowEditValue(showChips[idx]);
        setShowSuggestionsOpen(true);
    };
    const saveEditShowChip = (idx) => {
        const trimmedValue = showEditValue.trim();
        
        if (trimmedValue === "") {
            setShowChips(showChips.filter((_, i) => i !== idx));
            setEditingShowIdx(null);
            setShowEditValue("");
            setShowSuggestionsOpen(false);
            return;
        }
        
        // Check if the value exists in suggestions
        const existsInSuggestions = showSuggestions.some(s => normalize(s) === normalize(trimmedValue));
        
        if (!existsInSuggestions && showSuggestions.length > 0) {
            // Show warning modal
            setPendingChipValue(trimmedValue);
            setPendingChipIndex(idx);
            setPendingChipType("show");
            setSimilarSuggestion(findSimilarSuggestion(trimmedValue, showSuggestions));
            setShowWarningModal(true);
            return;
        }
        
        // Proceed with saving
        setShowChips(showChips.map((chip, i) => (i === idx ? trimmedValue : chip)));
        setEditingShowIdx(null);
        setShowEditValue("");
        setShowSuggestionsOpen(false);
    };
    const cancelEditShowChip = () => {
        setEditingShowIdx(null);
        setShowEditValue("");
        setShowSuggestionsOpen(false);
    };
    const addShowChip = () => {
        setShowChips([...showChips, ""]);
        setEditingShowIdx(showChips.length);
        setShowEditValue("");
        setShowSuggestionsOpen(true);
    };
    const removeShowChip = (idx) => setShowChips(showChips.filter((_, i) => i !== idx));

    const startEditIndexChip = (idx) => {
        setEditingIndexIdx(idx);
        setIndexEditValue(indexChips[idx]);
        setIndexSuggestionsOpen(true);
    };
    const saveEditIndexChip = (idx) => {
        const trimmedValue = indexEditValue.trim();
        
        if (trimmedValue === "") {
            setIndexChips(indexChips.filter((_, i) => i !== idx));
            setEditingIndexIdx(null);
            setIndexEditValue("");
            setIndexSuggestionsOpen(false);
            return;
        }
        
        // Check if the value exists in suggestions
        const existsInSuggestions = indexSuggestions.some(s => normalize(s) === normalize(trimmedValue));
        
        if (!existsInSuggestions && indexSuggestions.length > 0) {
            // Show warning modal
            setPendingChipValue(trimmedValue);
            setPendingChipIndex(idx);
            setPendingChipType("index");
            setSimilarSuggestion(findSimilarSuggestion(trimmedValue, indexSuggestions));
            setShowWarningModal(true);
            return;
        }
        
        // Proceed with saving
        setIndexChips(indexChips.map((chip, i) => (i === idx ? trimmedValue : chip)));
        setEditingIndexIdx(null);
        setIndexEditValue("");
        setIndexSuggestionsOpen(false);
    };
    const cancelEditIndexChip = () => {
        setEditingIndexIdx(null);
        setIndexEditValue("");
        setIndexSuggestionsOpen(false);
    };
    const addIndexChip = () => {
        setIndexChips([...indexChips, ""]);
        setEditingIndexIdx(indexChips.length);
        setIndexEditValue("");
        setIndexSuggestionsOpen(true);
    };
    const removeIndexChip = (idx) => setIndexChips(indexChips.filter((_, i) => i !== idx));

    // Modal handlers
    const confirmSaveChip = () => {
        if (pendingChipType === "show") {
            setShowChips(showChips.map((chip, i) => (i === pendingChipIndex ? pendingChipValue : chip)));
            setEditingShowIdx(null);
            setShowEditValue("");
            setShowSuggestionsOpen(false);
        } else if (pendingChipType === "index") {
            setIndexChips(indexChips.map((chip, i) => (i === pendingChipIndex ? pendingChipValue : chip)));
            setEditingIndexIdx(null);
            setIndexEditValue("");
            setIndexSuggestionsOpen(false);
        }
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setPendingChipType("");
        setSimilarSuggestion("");
    };
    
    const useSuggestedChip = () => {
        if (pendingChipType === "show") {
            setShowChips(showChips.map((chip, i) => (i === pendingChipIndex ? similarSuggestion : chip)));
            setEditingShowIdx(null);
            setShowEditValue("");
            setShowSuggestionsOpen(false);
        } else if (pendingChipType === "index") {
            setIndexChips(indexChips.map((chip, i) => (i === pendingChipIndex ? similarSuggestion : chip)));
            setEditingIndexIdx(null);
            setIndexEditValue("");
            setIndexSuggestionsOpen(false);
        }
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setPendingChipType("");
        setSimilarSuggestion("");
    };
    
    const cancelSaveChip = () => {
        setShowWarningModal(false);
        setPendingChipValue("");
        setPendingChipIndex(null);
        setPendingChipType("");
        setSimilarSuggestion("");
        // Keep editing the current chip
    };

    // Filter suggestions as user types
    const filteredShowSuggestions = showEditValue
        ? showSuggestions.filter(s => s.toLowerCase().includes(showEditValue.toLowerCase()) && !showChips.includes(s))
        : showSuggestions.filter(s => !showChips.includes(s));
    const filteredIndexSuggestions = indexEditValue
        ? indexSuggestions.filter(s => s.toLowerCase().includes(indexEditValue.toLowerCase()) && !indexChips.includes(s))
        : indexSuggestions.filter(s => !indexChips.includes(s));

    // Update parent state when chips change (same as before)
    useEffect(() => {
        const toBeNewValue = {
            Index: indexChips,
            Show: showChips,
            Original: initialValue.Original || []
        };
        if (
            showChips.join("\n") !== (initialValue.Show || []).join("\n") ||
            indexChips.join("\n") !== (initialValue.Index || []).join("\n")
        ) {
            setUpdateObject((old) => ({ ...old, [accessKey.key]: toBeNewValue }));
        } else {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
        }
    }, [showChips, indexChips]);

    return (
        <>
            <div className="input-group flex-column align-items-start w-100">
                <div className="row w-100">
                    <div className="col-12 col-md-6">
                        <small className="input-group-text mb-1">Mostrar</small>
                        <div className="chips-box mb-2 w-100 position-relative">
                            {showChips.map((chip, idx) => (
                                <span className="chip" key={idx}>
                                    {editingShowIdx === idx ? (
                                        <>
                                            <input
                                                className="chip-edit-input"
                                                value={showEditValue}
                                                autoFocus
                                                onChange={e => { setShowEditValue(e.target.value); setShowSuggestionsOpen(true); }}
                                                onBlur={() => saveEditShowChip(idx)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") saveEditShowChip(idx);
                                                    if (e.key === "Escape") cancelEditShowChip();
                                                }}
                                            />
                                            {showSuggestionsOpen && filteredShowSuggestions.length > 0 && (
                                                <ul className="suggestions-list">
                                                    {filteredShowSuggestions.map((s, i) => (
                                                        <li key={i} onMouseDown={() => { setShowEditValue(s); setShowSuggestionsOpen(false); setTimeout(() => saveEditShowChip(idx), 0); }}>{s}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    ) : (
                                        <span onClick={() => startEditShowChip(idx)} style={{cursor:'pointer'}}>{chip}</span>
                                    )}
                                    <button type="button" className="chip-remove" onClick={() => removeShowChip(idx)}>&times;</button>
                                </span>
                            ))}
                            <button type="button" className="chip-add" onClick={addShowChip}>+</button>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
                        <small className="input-group-text mb-1">Índice</small>
                        <div className="chips-box w-100 position-relative">
                            {indexChips.map((chip, idx) => (
                                <span className="chip" key={idx}>
                                    {editingIndexIdx === idx ? (
                                        <>
                                            <input
                                                className="chip-edit-input"
                                                value={indexEditValue}
                                                autoFocus
                                                onChange={e => { setIndexEditValue(e.target.value); setIndexSuggestionsOpen(true); }}
                                                onBlur={() => saveEditIndexChip(idx)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") saveEditIndexChip(idx);
                                                    if (e.key === "Escape") cancelEditIndexChip();
                                                }}
                                            />
                                            {indexSuggestionsOpen && filteredIndexSuggestions.length > 0 && (
                                                <ul className="suggestions-list">
                                                    {filteredIndexSuggestions.map((s, i) => (
                                                        <li key={i} onMouseDown={() => { setIndexEditValue(s); setIndexSuggestionsOpen(false); setTimeout(() => saveEditIndexChip(idx), 0); }}>{s}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    ) : (
                                        <span onClick={() => startEditIndexChip(idx)} style={{cursor:'pointer'}}>{chip}</span>
                                    )}
                                    <button type="button" className="chip-remove" onClick={() => removeIndexChip(idx)}>&times;</button>
                                </span>
                            ))}
                            <button type="button" className="chip-add" onClick={addIndexChip}>+</button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Warning Modal */}
            {showWarningModal && (
                <div className="modal show" tabIndex={-1} style={{
                    display: 'block',
                    background: 'rgba(0,0,0,0.4)',
                    zIndex: 1050
                }}>
                    <div className="modal-dialog modal-dialog-centered" style={{maxWidth: 400}}>
                        <div className="modal-content" style={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            background: '#ffffff'
                        }}>
                            <div className="modal-body" style={{padding: '1.5rem', textAlign: 'center'}}>
                                <div style={{
                                    fontSize: '1rem', 
                                    color: '#374151', 
                                    marginBottom: '1rem',
                                    lineHeight: 1.5
                                }}>
                                    O termo <strong>&quot;{pendingChipValue}&quot;</strong> não existe na lista de sugestões para o campo <strong>&quot;{accessKey.name} ({pendingChipType === 'show' ? 'Mostrar' : 'Índice'})&quot;</strong>.
                                </div>
                                {similarSuggestion && (
                                    <div style={{
                                        fontSize: '0.9rem', 
                                        color: '#1f2937', 
                                        marginBottom: '1.5rem',
                                        padding: '0.75rem',
                                        background: '#f3f4f6',
                                        borderRadius: 6,
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        Sugestão: <strong>&quot;{similarSuggestion}&quot;</strong>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer" style={{
                                border: 'none', 
                                justifyContent: 'center', 
                                gap: 8, 
                                padding: '0 1.5rem 1.5rem 1.5rem'
                            }}>
                                <button className="btn btn-outline-secondary" style={{
                                    borderRadius: 6,
                                    padding: '8px 16px',
                                    fontSize: '0.9rem'
                                }} onClick={cancelSaveChip}>
                                    Cancelar
                                </button>
                                {similarSuggestion && (
                                    <button className="btn btn-primary" style={{
                                        borderRadius: 6,
                                        padding: '8px 16px',
                                        fontSize: '0.9rem'
                                    }} onClick={useSuggestedChip}>
                                        Usar Sugestão
                                    </button>
                                )}
                                <button className="btn btn-warning" style={{
                                    borderRadius: 6,
                                    padding: '8px 16px',
                                    fontSize: '0.9rem'
                                }} onClick={confirmSaveChip}>
                                    Criar
                                </button>
                            </div>
            </div>
        </div>
    </div>
            )}
            
            <style jsx>{`
                .chips-box {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5em;
                    background: #f8fafc;
                    border: 1.5px solid #d0d7de;
                    border-radius: 8px;
                    padding: 0.5em;
                    min-height: 48px;
                }
                .chip {
                    display: inline-flex;
                    align-items: center;
                    background: #e3f2fd;
                    color: #1565c0;
                    border-radius: 16px;
                    padding: 0.25em 0.75em;
                    font-size: 1em;
                    font-weight: 500;
                }
                .chip-remove {
                    background: none;
                    border: none;
                    color: #1976d2;
                    font-size: 1.2em;
                    margin-left: 0.5em;
                    cursor: pointer;
                }
                .chip-add {
                    background: #1976d2;
                    color: #fff;
                    border: none;
                    border-radius: 50%;
                    width: 2em;
                    height: 2em;
                    font-size: 1.3em;
                    margin-left: 0.5em;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .chip-edit-input {
                    border: none;
                    outline: none;
                    font-size: 1em;
                    background: #fff;
                    min-width: 80px;
                    margin-right: 0.5em;
                }
                .suggestions-list {
                    position: absolute;
                    left: 0;
                    top: 100%;
                    z-index: 10;
                    background: #fff;
                    border: 1px solid #1976d2;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px #1976d255;
                    list-style: none;
                    margin: 0;
                    padding: 0.25em 0;
                    min-width: 180px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .suggestions-list li {
                    padding: 0.4em 1em;
                    cursor: pointer;
                    color: #1976d2;
                    font-weight: 500;
                }
                .suggestions-list li:hover {
                    background: #e3f2fd;
                }
            `}</style>
        </>
    );
}