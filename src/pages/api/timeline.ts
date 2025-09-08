import search, { createQueryDslQueryContainer, populateFilters, SearchFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import type { NextApiRequest, NextApiResponse } from 'next';

// This API route will now return the raw documents, and the client will handle the date grouping.
// This bypasses the server-side date aggregation error.
export default LoggerApi(async function timelineHandler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    const { query } = req;
    
    // Manually construct the filter array for the main query
    const mustClauses: any[] = [];

    // Date range filter
    if (query.MinAno || query.MaxAno) {
      const rangeQuery: any = { range: { Data: {} } };
      if (query.MinAno) rangeQuery.range.Data.gte = query.MinAno;
      if (query.MaxAno) rangeQuery.range.Data.lte = query.MaxAno;
      mustClauses.push(rangeQuery);
    }

    // Metadata filters (Decisão, Relator, etc.)
    Object.keys(query).forEach(key => {
      // Explicitly define parameters that should NOT be treated as metadata filters.
      const ignoredParams = ['timePeriod', 'q', 'MinAno', 'MaxAno', 'sort', 'page', 'group'];
      if (ignoredParams.includes(key)) return; 
      
      const value = query[key] as string;
      if (value) {
        // Use a wildcard query for more flexible matching.
        // This allows partial matches (e.g., "Acordão" matches "Acordão de...").
        mustClauses.push({ 
          wildcard: { 
            // The field name needs the .Index.keyword suffix for text fields
            [`${key}.Index.keyword`]: {
              value: `*${value}*`,
              case_insensitive: true
            } 
          } 
        });
      }
    });

    const sfilters: SearchFilters = {
      pre: [{ bool: { must: mustClauses } }],
      after: []
    };

    const authed = await authenticatedHandler(req);
    const searchQuery = createQueryDslQueryContainer(query.q as string | string[] | undefined);
    
    // Fetch up to 10,000 matching documents. We are no longer aggregating.
    const body = await search(
      searchQuery, 
      sfilters, 
      0, 
      {}, // No aggregations
      10000, 
      {_source: ["Data", "ECLI"]}, // Fetch Data and ECLI
      authed
    );
    
    // Return the raw search hits
    const documents = body.hits.hits.map(hit => hit._source);
    return res.status(200).json(documents);

  } catch (error) {
    console.error('Timeline API error:', error);
    return res.status(500).json({ error: 'Erro ao carregar dados temporais: ' + (error as Error).message });
  }
}); 