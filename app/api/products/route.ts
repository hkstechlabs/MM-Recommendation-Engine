import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection');
    const brand = searchParams.get('brand');

    if (!collection || !brand) {
      return NextResponse.json({ error: 'Collection and brand parameters are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch products that match the collection (product_type) and brand (vendor)
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        title,
        vendor,
        product_type,
        status,
        tags,
        product_created_at,
        variants (
          id,
          variant_id,
          title,
          price,
          sku,
          storage,
          condition,
          color,
          inventory_quantity
        )
      `)
      .eq('product_type', collection)
      .eq('vendor', brand)
      .eq('status', 'active')
      .order('product_created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}