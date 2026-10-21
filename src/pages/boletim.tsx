import GenericPage from "@/components/main_pages/genericPageStructure"
import { SmallSpinner } from "@/components/loading"
import { getElasticSearchClient } from "@/core/elasticsearch"
import { LoggerServerSideProps } from "@/core/logger-api"
import { JurisprudenciaVersion } from "@stjiris/jurisprudencia-document"
import { GetServerSideProps } from "next"
import { useRouter } from "next/router"
import { useEffect, useMemo, useRef, useState } from "react"

interface BoletimProps {
    areas: string[]
    minYear: number
    maxYear: number
}

export const getServerSideProps: GetServerSideProps<BoletimProps> = LoggerServerSideProps(async (ctx) => {
    try {
        const client = await getElasticSearchClient()
        const result = await client.search({
            index: JurisprudenciaVersion,
            size: 0,
            aggs: {
                areas: {
                    terms: {
                        field: "Área.Index.keyword",
                        size: 100,
                        order: { _key: "asc" }
                    }
                },
                minYear: {
                    min: { field: "Data", format: "yyyy" }
                },
                maxYear: {
                    max: { field: "Data", format: "yyyy" }
                }
            }
        })

        const areasBuckets = (result.aggregations?.areas as any)?.buckets || []
        const areas = areasBuckets.map((b: any) => b.key as string)
        const minYear = parseInt((result.aggregations?.minYear as any)?.value_as_string || "2000") || 2000
        const maxYear = parseInt((result.aggregations?.maxYear as any)?.value_as_string || new Date().getFullYear().toString()) || new Date().getFullYear()

        return { props: { areas: areas.length > 0 ? areas : ["Área Social", "Área Cível", "Área Criminal", "Contencioso"], minYear, maxYear } }
    } catch (e) {
        console.warn("[Boletim] Elasticsearch indisponível ou offline. A utilizar dados e secções por omissão.");
        const currentYear = new Date().getFullYear();
        return {
            props: {
                areas: ["Área Social", "Área Cível", "Área Criminal", "Contencioso"],
                minYear: 2020,
                maxYear: currentYear
            }
        };
    }
})

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function getAreaLabel(area: string): string {
    if (area.includes("Social")) return "Secção Social (4.ª Secção)";
    if (area.includes("Cível") || area.includes("Civel")) return "Secções Cíveis (1.ª, 2.ª e 7.ª Secções)";
    if (area.includes("Criminal")) return "Secções Criminais (3.ª e 5.ª Secções)";
    if (area.includes("Contencioso")) return "Secção de Contencioso";
    return area;
}

export default function Boletim({ areas, minYear, maxYear }: BoletimProps) {
    const router = useRouter()
    const now = new Date()
    const [area, setArea] = useState(areas[0] || "")
    const [year, setYear] = useState(now.getFullYear().toString())
    const [month, setMonth] = useState((now.getMonth() + 1).toString())
    const [descritor, setDescritor] = useState("")
    const [debouncedDescritor, setDebouncedDescritor] = useState("")
    const [isDebouncing, setIsDebouncing] = useState(false)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [fontSize, setFontSize] = useState("11pt")
    const [indexPosition, setIndexPosition] = useState<"start" | "end">("end")

    const [count, setCount] = useState<number | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null)
    const didInit = useRef(false)

    const years = useMemo(() => {
        const result = []
        for (let y = maxYear; y >= minYear; y--) {
            result.push(y)
        }
        return result
    }, [minYear, maxYear])

    // Debounce the descriptor input to prevent premature count queries and warnings
    useEffect(() => {
        setIsDebouncing(true)
        const timer = setTimeout(() => {
            setDebouncedDescritor(descritor.trim())
            setIsDebouncing(false)
        }, 350)
        return () => clearTimeout(timer)
    }, [descritor])

    // Autocomplete: fetch matching descriptors as the user types
    useEffect(() => {
        const term = descritor.trim()
        if (term.length < 2) {
            setSuggestions([])
            return
        }
        let cancelled = false
        fetch(`${router.basePath}/api/datalist?agg=Descritores&prefix=${encodeURIComponent(term)}`)
            .then(r => r.json())
            .then((items: { key: string; count?: number }[]) => {
                if (cancelled) return
                if (Array.isArray(items)) {
                    setSuggestions(items.map(it => it.key).filter(Boolean).slice(0, 30))
                }
            })
            .catch(() => {
                if (!cancelled) setSuggestions([])
            })
        return () => { cancelled = true }
    }, [descritor, router.basePath])

    const buildQueryString = useMemo(() => {
        const params = new URLSearchParams()
        if (debouncedDescritor) params.set("descritor", debouncedDescritor)
        if (fontSize && fontSize !== "11pt") params.set("fontSize", fontSize)
        if (indexPosition && indexPosition !== "end") params.set("indexPosition", indexPosition)
        const qs = params.toString()
        return qs ? `?${qs}` : ""
    }, [debouncedDescritor, fontSize, indexPosition])

    const htmlUrl = useMemo(() => {
        return `${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html${buildQueryString}`
    }, [router.basePath, area, year, month, buildQueryString])

    const pdfUrl = useMemo(() => {
        return `${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/pdf${buildQueryString}`
    }, [router.basePath, area, year, month, buildQueryString])

    const handleFontSizeChange = (newSize: string) => {
        setFontSize(newSize)
        if (previewUrl) {
            const params = new URLSearchParams()
            if (descritor.trim()) params.set("descritor", descritor.trim())
            if (newSize !== "11pt") params.set("fontSize", newSize)
            if (indexPosition !== "end") params.set("indexPosition", indexPosition)
            const qs = params.toString() ? `?${params.toString()}` : ""
            setPreviewUrl(`${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html${qs}`)
        }
    }

    const handleIndexPositionChange = (newPos: "start" | "end") => {
        setIndexPosition(newPos)
        if (previewUrl) {
            const params = new URLSearchParams()
            if (descritor.trim()) params.set("descritor", descritor.trim())
            if (fontSize !== "11pt") params.set("fontSize", fontSize)
            if (newPos !== "end") params.set("indexPosition", newPos)
            const qs = params.toString() ? `?${params.toString()}` : ""
            setPreviewUrl(`${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html${qs}`)
        }
    }

    // Count acórdãos for the current combination to guard both buttons.
    useEffect(() => {
        let cancelled = false
        setCount(null)
        const params = new URLSearchParams({ area, year, month })
        if (debouncedDescritor) params.set("descritor", debouncedDescritor)

        fetch(`${router.basePath}/api/boletim/count?${params.toString()}`)
            .then(r => r.json())
            .then(({ count }) => {
                if (cancelled) return
                setCount(count)
                // Auto-generate the HTML preview once, on first page entry.
                if (!didInit.current && count > 0) {
                    didInit.current = true
                    setPreviewUrl(`${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html${buildQueryString}`)
                }
            })
            .catch(() => { if (!cancelled) setCount(0) })
        return () => { cancelled = true }
    }, [router.basePath, area, year, month, debouncedDescritor, buildQueryString])

    const hasAcordaos = count !== null && count > 0
    const previewStale = previewUrl !== htmlUrl
    const pdfStale = lastPdfUrl !== pdfUrl

    const previewRef = useRef<HTMLDivElement>(null)
    const shouldScroll = useRef(false)

    const generatePreview = () => {
        shouldScroll.current = true
        setPreviewUrl(htmlUrl)
    }
    const generatePdf = () => {
        window.open(pdfUrl, "_blank", "noopener,noreferrer")
        setLastPdfUrl(pdfUrl)
    }

    const printIframe = () => {
        const iframe = previewRef.current?.querySelector("iframe")
        if (iframe?.contentWindow) {
            iframe.contentWindow.print()
        }
    }

    // Scroll the preview into view when the user generates it, so only the iframe is visible.
    useEffect(() => {
        if (previewUrl && shouldScroll.current) {
            shouldScroll.current = false
            previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }, [previewUrl])

    return (
        <GenericPage title="Jurisprudência STJ - Boletim">
            <div className="row justify-content-center mt-4">
                <div className="col-12 col-md-8 col-lg-7">
                    <h3 className="mb-3">Boletim de Jurisprudência</h3>
                    <div className="card">
                        <div className="card-body">
                            <div className="mb-3">
                                <label htmlFor="area-select" className="form-label fw-bold">Secção / Área</label>
                                <select
                                    id="area-select"
                                    className="form-select"
                                    value={area}
                                    onChange={e => setArea(e.target.value)}
                                >
                                    {areas.map(a => (
                                        <option key={a} value={a}>{getAreaLabel(a)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="row mb-3">
                                <div className="col-6">
                                    <label htmlFor="year-select" className="form-label fw-bold">Ano</label>
                                    <select
                                        id="year-select"
                                        className="form-select"
                                        value={year}
                                        onChange={e => setYear(e.target.value)}
                                    >
                                        {years.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label htmlFor="month-select" className="form-label fw-bold">Período / Mês</label>
                                    <select
                                        id="month-select"
                                        className="form-select"
                                        value={month}
                                        onChange={e => setMonth(e.target.value)}
                                    >
                                        <option value="all">Ano Inteiro (Boletim Anual)</option>
                                        {MONTHS.map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="row mb-3">
                                <div className="col-6">
                                    <label htmlFor="font-size-select" className="form-label fw-bold">Tamanho da Letra</label>
                                    <select
                                        id="font-size-select"
                                        className="form-select"
                                        value={fontSize}
                                        onChange={e => handleFontSizeChange(e.target.value)}
                                    >
                                        <option value="10pt">10pt (Pequeno)</option>
                                        <option value="11pt">11pt (Normal - Padrão)</option>
                                        <option value="12pt">12pt (Médio)</option>
                                        <option value="13pt">13pt (Grande)</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label htmlFor="index-position-select" className="form-label fw-bold">Posição do Índice</label>
                                    <select
                                        id="index-position-select"
                                        className="form-select"
                                        value={indexPosition}
                                        onChange={e => handleIndexPositionChange(e.target.value as "start" | "end")}
                                    >
                                        <option value="end">No Fim do Boletim (Padrão)</option>
                                        <option value="start">No Início do Boletim</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="descritor-input" className="form-label fw-bold">
                                    Descritor / Tema <span className="text-muted fw-normal">(opcional - Caderno Temático)</span>
                                </label>
                                <input
                                    id="descritor-input"
                                    list="descritores-datalist"
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: Acordo de empresa, Herança indivisa, Tráfico de menor gravidade..."
                                    value={descritor}
                                    onChange={e => setDescritor(e.target.value)}
                                    autoComplete="off"
                                />
                                <datalist id="descritores-datalist">
                                    {suggestions.map((s, idx) => (
                                        <option key={`${s}-${idx}`} value={s} />
                                    ))}
                                </datalist>
                                {descritor.trim().length >= 2 && suggestions.length > 0 && (
                                    <div className="form-text text-muted mt-1">
                                        <small>
                                            <i className="bi bi-lightbulb me-1 text-warning"></i>
                                            Sugestões: {suggestions.slice(0, 3).join(", ")}{suggestions.length > 3 ? "..." : ""}
                                        </small>
                                    </div>
                                )}
                            </div>
                            {count === null || isDebouncing ? (
                                <div className="d-flex align-items-center text-muted">
                                    <SmallSpinner className="me-2" />
                                    A verificar acórdãos...
                                </div>
                            ) : count === 0 ? (
                                <div className="alert alert-warning mb-0" role="alert">
                                    Não existem acórdãos para esta combinação.
                                </div>
                            ) : (
                                <div className="row g-2">
                                    <div className="col-6">
                                        <button
                                            type="button"
                                            className="btn btn-primary w-100"
                                            disabled={!hasAcordaos || !previewStale}
                                            onClick={generatePreview}
                                        >
                                            Gerar Boletim
                                        </button>
                                    </div>
                                    <div className="col-6">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary w-100"
                                            disabled={!hasAcordaos || !pdfStale}
                                            onClick={generatePdf}
                                        >
                                            Gerar PDF
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {previewUrl && (
                        <div className="card mt-3 shadow-sm" ref={previewRef} style={{ scrollMarginTop: "0.5rem" }}>
                            <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
                                <span className="small text-muted">
                                    <strong>{count}</strong> {count === 1 ? "acórdão encontrado" : "acórdãos encontrados"}
                                </span>
                                <div className="d-flex gap-2">
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-secondary"
                                    >
                                        Abrir noutro separador
                                    </a>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={printIframe}
                                    >
                                        Imprimir / Guardar PDF
                                    </button>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <iframe
                                    src={previewUrl}
                                    title="Pré-visualização do boletim"
                                    className="w-100 border-0"
                                    style={{ height: "95vh" }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </GenericPage>
    )
}
