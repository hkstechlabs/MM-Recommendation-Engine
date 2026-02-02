import { NextResponse } from 'next/server';

const SHOPIFY_API_URL = 'https://ozmobiles-com-au.myshopify.com/admin/api/2024-01/graphql.json';
const SHOPIFY_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN;

export interface ProductVendor {
  node: string;
}

export interface ProductVendorsResponse {
  data: {
    productVendors: {
      edges: ProductVendor[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}

export async function GET() {
  if (!SHOPIFY_ACCESS_TOKEN) {
    console.error('Shopify access token is not configured');
    return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
  }

  try {
    const response = await fetch(SHOPIFY_API_URL, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
          productVendors(first: 250) {
            edges {
              node
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ProductVendorsResponse = await response.json();
    return NextResponse.json({ productVendors: result.data.productVendors.edges });
  } catch (error) {
    console.error('Error fetching product vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch product vendors' }, { status: 500 });
  }
}