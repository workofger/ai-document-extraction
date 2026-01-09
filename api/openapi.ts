import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the OpenAPI spec file
    const specPath = join(process.cwd(), 'public', 'openapi.yaml');
    const spec = readFileSync(specPath, 'utf-8');

    // Return based on Accept header or query param
    const format = req.query.format || 'yaml';
    
    if (format === 'json') {
      // Convert YAML to JSON
      const yaml = require('yaml');
      const parsed = yaml.parse(spec);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(parsed);
    }

    res.setHeader('Content-Type', 'text/yaml');
    return res.status(200).send(spec);
  } catch (error) {
    console.error('Error reading OpenAPI spec:', error);
    return res.status(500).json({ error: 'Failed to load OpenAPI specification' });
  }
}

