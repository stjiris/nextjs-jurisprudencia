import GenericPage from "@/components/genericPageStructure"
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

export const getServerSideProps: GetServerSideProps<BoletimProps> = async (ctx) => {
    LoggerServerSideProps(ctx)
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

    return { props: { areas, minYear, maxYear } }
}

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

export default function Boletim({ areas, minYear, maxYear }: BoletimProps) {
    const router = useRouter()
    const now = new Date()
    const [area, setArea] = useState(areas[0] || "")
    const [year, setYear] = useState(now.getFullYear().toString())
    const [month, setMonth] = useState((now.getMonth() + 1).toString())

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

    const htmlUrl = useMemo(() => {
        return `${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html`
    }, [router.basePath, area, year, month])

    const pdfUrl = useMemo(() => {
        return `${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/pdf`
    }, [router.basePath, area, year, month])

    // Count acórdãos for the current combination to guard both buttons.
    useEffect(() => {
        let cancelled = false
        setCount(null)
        const params = new URLSearchParams({ area, year, month })
        fetch(`${router.basePath}/api/boletim/count?${params.toString()}`)
            .then(r => r.json())
            .then(({ count }) => {
                if (cancelled) return
                setCount(count)
                // Auto-generate the HTML preview once, on first page entry.
                if (!didInit.current && count > 0) {
                    didInit.current = true
                    setPreviewUrl(`${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/html`)
                }
            })
            .catch(() => { if (!cancelled) setCount(0) })
        return () => { cancelled = true }
    }, [router.basePath, area, year, month])

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
                <div className="col-12 col-md-8 col-lg-6">
                    <h3 className="mb-3">Boletim Mensal</h3>
                    <div className="card">
                        <div className="card-body">
                            <div className="mb-3">
                                <label htmlFor="area-select" className="form-label fw-bold">Área</label>
                                <select
                                    id="area-select"
                                    className="form-select"
                                    value={area}
                                    onChange={e => setArea(e.target.value)}
                                >
                                    {areas.map(a => (
                                        <option key={a} value={a}>{a}</option>
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
                                    <label htmlFor="month-select" className="form-label fw-bold">Mês</label>
                                    <select
                                        id="month-select"
                                        className="form-select"
                                        value={month}
                                        onChange={e => setMonth(e.target.value)}
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {count === null ? (
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
                        <div className="card mt-3" ref={previewRef} style={{ scrollMarginTop: "0.5rem" }}>
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
