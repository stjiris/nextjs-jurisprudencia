import { NextApiRequest, NextApiResponse } from 'next';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { getElasticSearchClient } from '@/core/elasticsearch';
import { updateDoc } from '@/core/doc';
import { JurisprudenciaVersion, JurisprudenciaDocument, GenericField } from '@stjiris/jurisprudencia-document';

// Map field names to their Elasticsearch field names
const fieldMapping: Record<string, string> = {
  'Descritores': 'Descritores.Show',
  'Meio Processual': 'Meio Processual.Show',
  'Decisão': 'Decisão.Show'
};

export default LoggerApi(async function normalizeHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Starting normalization process...');
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authed = await authenticatedHandler(req);
  if (!authed) {
    console.log('Authentication failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Processing request body...');
    const { field, fromValue, toValue } = req.body;
    console.log('Request parameters:', { field, fromValue, toValue });

    if (!field || !fromValue || !toValue) {
      console.log('Missing parameters:', { field, fromValue, toValue });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const esField = fieldMapping[field];
    if (!esField) {
      console.log('Invalid field mapping:', { field, availableFields: Object.keys(fieldMapping) });
      return res.status(400).json({ error: 'Invalid field' });
    }
    console.log('Using Elasticsearch field:', esField);

    console.log('Getting Elasticsearch client...');
    const client = await getElasticSearchClient();
    
    // Find all documents that need to be updated
    console.log('Searching for documents to update...');
    const searchQuery = {
      index: JurisprudenciaVersion,
      query: {
        term: {
          [esField]: fromValue
        }
      },
      _source: true,
      size: 10000
    };
    console.log('Search query:', JSON.stringify(searchQuery, null, 2));

    const searchResult = await client.search<JurisprudenciaDocument>(searchQuery);
    console.log('Search results count:', searchResult.hits.hits.length);
    if (searchResult.hits.hits.length > 0) {
      console.log('First result sample:', JSON.stringify(searchResult.hits.hits[0]._source, null, 2));
    }

    if (!searchResult.hits.hits || searchResult.hits.hits.length === 0) {
      console.log('No documents found to update');
      return res.json({
        success: true,
        updatedCount: 0,
        message: 'No documents found to update'
      });
    }

    const docIds = searchResult.hits.hits.map(hit => hit._id);
    console.log('Found document IDs:', docIds);
    
    // Update each document
    console.log('Starting document updates...');
    const updatePromises = docIds.map(docId => {
      console.log(`Updating document ${docId}...`);
      const doc = searchResult.hits.hits.find(hit => hit._id === docId)?._source;
      if (!doc) {
        console.log(`Document ${docId} not found in search results`);
        return Promise.reject(new Error(`Document ${docId} not found in search results`));
      }
      const currentValue = doc[field as keyof JurisprudenciaDocument] as GenericField;
      if (!currentValue || !currentValue.Show) {
        console.log(`Document ${docId} has invalid field structure for ${field}`);
        return Promise.reject(new Error(`Document ${docId} has invalid field structure for ${field}`));
      }
      // Update de Mostrar, deixar Original e Index igual
      const updatedValue: GenericField = {
        ...currentValue,
        Show: currentValue.Show.map(v => v === fromValue ? toValue : v),
        Index: currentValue.Index.map(v => v === fromValue ? toValue : v)
      };
      return updateDoc(docId, { [field]: updatedValue });
    });

    const results = await Promise.all(updatePromises);
    console.log('Update results:', results);

    return res.json({
      success: true,
      updatedCount: results.length,
      results
    });
  } catch (error) {
    console.error('Detailed error during normalization:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ 
      error: 'Failed to normalize documents',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}); 