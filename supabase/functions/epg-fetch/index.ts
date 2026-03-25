import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EPGProgram {
  channel_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category?: string;
  source_url?: string;
}

function parseXMLTV(xml: string, sourceUrl: string): EPGProgram[] {
  const programs: EPGProgram[] = [];
  
  // Parse <programme> tags
  const programRegex = /<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/gi;
  let match;
  
  while ((match = programRegex.exec(xml)) !== null) {
    const [, startStr, stopStr, channelId, content] = match;
    
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = content.match(/<desc[^>]*>([^<]+)<\/desc>/i);
    const catMatch = content.match(/<category[^>]*>([^<]+)<\/category>/i);
    
    if (!titleMatch) continue;
    
    // Parse XMLTV date format: 20260325120000 +0000
    const parseDate = (str: string): string => {
      const clean = str.replace(/\s+[+-]\d{4}$/, '');
      const y = clean.substring(0, 4);
      const m = clean.substring(4, 6);
      const d = clean.substring(6, 8);
      const h = clean.substring(8, 10);
      const min = clean.substring(10, 12);
      const sec = clean.substring(12, 14) || '00';
      const tzMatch = str.match(/([+-]\d{4})$/);
      const tz = tzMatch ? tzMatch[1].substring(0, 3) + ':' + tzMatch[1].substring(3) : '+00:00';
      return `${y}-${m}-${d}T${h}:${min}:${sec}${tz}`;
    };
    
    programs.push({
      channel_id: channelId,
      title: titleMatch[1].trim(),
      description: descMatch?.[1]?.trim(),
      start_time: parseDate(startStr),
      end_time: parseDate(stopStr),
      category: catMatch?.[1]?.trim(),
      source_url: sourceUrl,
    });
  }
  
  return programs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action } = body;

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Action: Fetch and store EPG data from XMLTV URL
    if (action === 'fetch') {
      const { epg_url } = body;
      if (!epg_url) {
        return new Response(JSON.stringify({ error: 'Missing epg_url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await fetch(epg_url);
      if (!res.ok) throw new Error(`Failed to fetch EPG: ${res.status}`);
      const xml = await res.text();

      const programs = parseXMLTV(xml, epg_url);

      if (programs.length === 0) {
        return new Response(JSON.stringify({ message: 'No programs found', count: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete old EPG data from this source
      await adminClient.from('epg_data').delete().eq('source_url', epg_url);

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < programs.length; i += batchSize) {
        const batch = programs.slice(i, i + batchSize);
        const { error } = await adminClient.from('epg_data').insert(batch);
        if (!error) inserted += batch.length;
      }

      return new Response(JSON.stringify({ message: 'EPG updated', count: inserted, total_parsed: programs.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Query EPG for a channel (current + next)
    if (action === 'query') {
      const { channel_id, limit: queryLimit } = body;
      if (!channel_id) {
        return new Response(JSON.stringify({ error: 'Missing channel_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const now = new Date().toISOString();
      const { data, error } = await adminClient
        .from('epg_data')
        .select('*')
        .eq('channel_id', channel_id)
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .limit(queryLimit || 5);

      if (error) throw error;

      return new Response(JSON.stringify({ programs: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use fetch or query' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
