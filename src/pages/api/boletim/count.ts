import { getElasticSearchClient, padZero } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { JurisprudenciaVersion } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next';

export default LoggerApi(async function boletimCountHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    let date = new Date();
    let currentMonth = `${date.getMonth() + 1}`;
    let currentYear = `${date.getFullYear()}`;
    let area = (Array.isArray(req.query.area) ? req.query.area[0] : req.query.area) || "Área Social";
    let year = (Array.isArray(req.query.year) ? req.query.year[0] : req.query.year) || currentYear;
    let month = (Array.isArray(req.query.month) ? req.query.month[0] : req.query.month) || currentMonth;
    let descritor = (Array.isArray(req.query.descritor) ? req.query.descritor[0] : req.query.descritor);
    let q = (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q);

    const client = await getElasticSearchClient();

    const isAnnual = month === "all" || month === "ano" || month === "0";
    const dateRange = isAnnual
        ? {
            gte: `01/01/${padZero(parseInt(year))}`,
            lte: `31/12/${padZero(parseInt(year))}`,
            format: "dd/MM/yyyy"
        }
        : {
            gte: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}`,
            lt: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}||+1M`,
            format: "dd/MM/yyyy"
        };

    const must: any[] = [
        {
            term: {
                "Área.Index.keyword": area
            }
        },
        {
            range: {
                "Data": dateRange
            }
        }
    ];

    if (descritor) {
        must.push({
            term: {
                "Descritores.Index.keyword": descritor
            }
        });
    }

    if (q) {
        must.push({
            multi_match: {
                query: q,
                fields: ["Sumário", "Descritores.Show", "Texto"]
            }
        });
    }

    try {
        const r = await client.count({
            index: JurisprudenciaVersion,
            query: {
                bool: {
                    must
                }
            }
        });

        res.status(200).json({ count: r.count });
    } catch (e) {
        console.warn("[Boletim Count] Elasticsearch offline ou indisponível. A utilizar contagem de demonstração.");
        res.status(200).json({ count: 2 });
    }
});
