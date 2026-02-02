import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { type, metadata, url } = await request.json();
    
    if (!type || !metadata || !url) {
      return NextResponse.json({ error: 'Type, metadata, and url are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if an event with this type, metadata, and url already exists
    const { data: existingEvent, error: fetchError } = await supabase
      .from('ui_events')
      .select('id, count')
      .eq('type', type)
      .eq('metadata', metadata)
      .eq('url', url)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching existing event:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingEvent) {
      // Update existing event by incrementing count
      const { data, error } = await supabase
        .from('ui_events')
        .update({ 
          count: (existingEvent.count || 0) + 1,
          created_at: new Date().toISOString()
        })
        .eq('id', existingEvent.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, event: data });
    } else {
      // Create new event
      const { data, error } = await supabase
        .from('ui_events')
        .insert({
          type,
          metadata,
          url,
          count: 1
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, event: data });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}