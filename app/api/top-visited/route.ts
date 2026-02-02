import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch top 5 most visited items for the specific URL
    const { data, error } = await supabase
      .from('ui_events')
      .select('metadata, count')
      .eq('type', 'click')
      .eq('url', url)
      .order('count', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching top visited:', error);
      return NextResponse.json({ error: 'Failed to fetch top visited' }, { status: 500 });
    }

    return NextResponse.json({ topVisited: data || [] });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}