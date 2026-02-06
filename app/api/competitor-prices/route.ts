import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const variantId = searchParams.get('variantId');

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First, get the variant's UUID from the variant_id (bigint)
    const { data: variantData, error: variantError } = await supabase
      .from('variants')
      .select('id')
      .eq('variant_id', variantId)
      .single();

    if (variantError || !variantData) {
      console.error('Error fetching variant:', variantError);
      return NextResponse.json(
        { competitorPrices: [] },
        { status: 200 }
      );
    }

    // Fetch competitor prices for this variant
    // Get the most recent price from each competitor
    const { data: competitorData, error: competitorError } = await supabase
      .from('scraped_data')
      .select(`
        price,
        stock,
        created_at,
        competitor_id,
        competitors (
          title
        )
      `)
      .eq('variant_id', variantData.id)
      .order('created_at', { ascending: false });

    if (competitorError) {
      console.error('Error fetching competitor prices:', competitorError);
      return NextResponse.json(
        { competitorPrices: [] },
        { status: 200 }
      );
    }

    // Group by competitor and get the most recent price for each
    const competitorMap = new Map();
    
    if (competitorData) {
      for (const item of competitorData) {
        const competitorName = (item.competitors as any)?.title || 'Unknown';
        
        // Only keep the most recent entry for each competitor
        if (!competitorMap.has(competitorName)) {
          competitorMap.set(competitorName, {
            competitor_name: competitorName,
            price: item.price,
            stock: item.stock || 0,
            created_at: item.created_at
          });
        }
      }
    }

    const competitorPrices = Array.from(competitorMap.values());

    return NextResponse.json({
      competitorPrices,
      count: competitorPrices.length
    });

  } catch (error) {
    console.error('Error in competitor-prices API:', error);
    return NextResponse.json(
      { error: 'Internal server error', competitorPrices: [] },
      { status: 500 }
    );
  }
}
