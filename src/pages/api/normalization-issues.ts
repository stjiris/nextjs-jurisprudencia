import { NextApiRequest, NextApiResponse } from 'next';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { getElasticSearchClient } from '@/core/elasticsearch';
import { AggregationsCompositeAggregationSource, AggregationsStringTermsAggregate } from '@elastic/elasticsearch/lib/api/types';

// Map field names to their Elasticsearch field names
const fieldMapping: Record<string, string> = {
  'Descritores': 'Descritores.Show.keyword',
  'Meio Processual': 'Meio Processual.Show.keyword',
  'Decisão': 'Decisão.Show.keyword'
};

// Helper to normalize Next.js query values to a single string (or undefined)
function queryToString(q: string | string[] | undefined): string | undefined {
  if (Array.isArray(q)) return q[0];
  return q;
}

export default LoggerApi(async function normalizationIssuesHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authed = await authenticatedHandler(req);
  if (!authed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Normalize and validate query params
  const field = queryToString(req.query.field);
  if (!field) {
    return res.status(400).json({ error: 'Field parameter is required' });
  }

  const sizeStr = queryToString(req.query.size);
  // Allow missing size (we'll default), but if provided it should be a number
  const parsedSize = sizeStr ? parseInt(sizeStr, 10) : NaN;
  const pageSize = Number.isNaN(parsedSize) ? 1500 : parsedSize;

  const afterStr = queryToString(req.query.after);
  let afterObj: unknown | undefined;
  if (afterStr) {
    try {
      afterObj = JSON.parse(afterStr);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid `after` parameter (must be JSON)' });
    }
  }

  const esField = fieldMapping[field];
  if (!esField) {
    return res.status(400).json({ error: 'Invalid field' });
  }

  try {
    const client = await getElasticSearchClient();
    const compositeSources = [
      { term: { terms: { field: esField } } }
    ] as unknown as Record<string, AggregationsCompositeAggregationSource>[];

    // NOTE: typing of result from client.search can be complex; cast to `any` for simplicity.
    const result: any = await client.search({
      index: 'your_index',
      size: 0,
      aggs: {
        terms_paged: {
          composite: {
            size: pageSize,
            sources: compositeSources,
              ...(afterObj ? { after: afterObj } : {})
            }
        }
      }
    });

    const aggs = (result.aggregations as any)?.terms_paged || {};
    const buckets: any[] = aggs.buckets || [];
    const after_key = aggs.after_key ?? null;

    // Convert buckets to array of terms with counts
    const terms = buckets.map((bucket: any) => ({
      value: (bucket.key && typeof bucket.key === 'string') ? bucket.key : String(bucket.key),
      count: bucket.doc_count
    }));

    // Pagination params
    const pageStr = queryToString(req.query.page);
    const page = pageStr ? (parseInt(pageStr, 10) || 1) : 1;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pagedBuckets = terms.slice(start, end);

    return res.json({
      normalization: [], // No clusters, just flat list
      rawTerms: terms,
      termAggregation: {
        buckets: pagedBuckets,
        after_key,
        total: terms.length
      }
    });
  } catch (error) {
    console.error('Error fetching normalization issues:', error);
    return res.status(500).json({ error: 'Failed to fetch normalization issues' });
  }
});
