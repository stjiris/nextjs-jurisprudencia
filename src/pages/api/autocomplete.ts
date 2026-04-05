import type { NextApiRequest, NextApiResponse } from 'next';
import { getAutocompleteSuggestions } from '../../core/elasticsearch'; 

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Apenas permitimos pedidos GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { q } = req.query;
    const query = Array.isArray(q) ? q[0] : q;

    if (!query || query.trim().length < 3) {
        return res.status(200).json([]);
    }

    try {
        const suggestions = await getAutocompleteSuggestions(query);
        return res.status(200).json(suggestions);
    } catch (error) {
        console.error("Autocomplete Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}