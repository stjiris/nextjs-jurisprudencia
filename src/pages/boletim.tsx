import GenericPage from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch"
import { LoggerServerSideProps } from "@/core/logger-api"
import { JurisprudenciaVersion } from "@stjiris/jurisprudencia-document"
import { GetServerSideProps } from "next"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"

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

    const years = useMemo(() => {
        const result = []
        for (let y = maxYear; y >= minYear; y--) {
            result.push(y)
        }
        return result
    }, [minYear, maxYear])

    const downloadUrl = useMemo(() => {
        return `${router.basePath}/api/boletim/${encodeURIComponent(area)}/${year}/${month}/pdf`
    }, [router.basePath, area, year, month])

    return (
        <GenericPage title="Jurisprudência STJ - Boletim">
            <div className="row justify-content-center mt-4">
                <div className="col-12 col-md-8 col-lg-6">
                    <h3 className="mb-3">Boletim de Sumários</h3>
                    <p className="text-muted">
                        Gere um documento PDF com os sumários dos acórdãos publicados, agrupados por área e período.
                    </p>
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
                            <a
                                href={downloadUrl}
                                className="btn btn-primary w-100"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <i className="bi bi-file-earmark-pdf me-2"></i>
                                Gerar Boletim PDF
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </GenericPage>
    )
}
