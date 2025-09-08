import { NextApiRequest, NextApiResponse } from 'next';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';

export default LoggerApi(async function normalizationFieldsHandler(
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

  // Return the fields we want to analyze
  return res.json({
    fields: [
      { key: 'Descritores', label: 'Descritores' },
      { key: 'Meio Processual', label: 'Meio Processual' },
      { key: 'Decisão', label: 'Decisão' }
    ]
  });
}); 