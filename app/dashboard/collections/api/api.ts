// GraphQL API service for Shopify
const SHOPIFY_API_URL = 'https://ozmobiles-com-au.myshopify.com/admin/api/2024-01/graphql.json';
const SHOPIFY_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN;

export interface ProductType {
  node: string;
}

export interface ProductTypesResponse {
  data: {
    productTypes: {
      edges: ProductType[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}

// Fetch product types from Shopify GraphQL API
export async function fetchProductTypes(): Promise<ProductType[]> {
  if (!SHOPIFY_ACCESS_TOKEN) {
    console.error('Shopify access token is not configured');
    return [];
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
          productTypes(first: 250) {
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

    const result: ProductTypesResponse = await response.json();
    return result.data.productTypes.edges;
  } catch (error) {
    console.error('Error fetching product types:', error);
    return [];
  }
}