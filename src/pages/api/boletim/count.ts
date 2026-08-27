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

    const client = await getElasticSearchClient();
    const r = await client.count({
        index: JurisprudenciaVersion,
        query: {
            bool: {
                must: [{
                    term: {
                        "Área.Index.keyword": area
                    }
                }, {
                    range: {
                        "Data": {
                            gte: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}`,
                            lt: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}\|\|+1M`,
                            format: "dd/MM/yyyy"
                        }
                    }
                }]
            }
        }
    });

    res.status(200).json({ count: r.count });
});
