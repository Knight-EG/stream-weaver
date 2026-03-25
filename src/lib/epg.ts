import { supabase } from '@/integrations/supabase/client';

export interface EPGProgram {
  id: string;
  channel_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category?: string;
}

export async function fetchEPGForChannel(channelId: string): Promise<EPGProgram[]> {
  const now = new Date().toISOString();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59);

  const { data, error } = await supabase
    .from('epg_data')
    .select('*')
    .eq('channel_id', channelId)
    .gte('end_time', now)
    .lte('start_time', endOfDay.toISOString())
    .order('start_time', { ascending: true });

  if (error) return [];
  return data || [];
}

export function getCurrentProgram(programs: EPGProgram[]): EPGProgram | null {
  const now = new Date();
  return programs.find(p => {
    const start = new Date(p.start_time);
    const end = new Date(p.end_time);
    return now >= start && now <= end;
  }) || null;
}

export function getNextProgram(programs: EPGProgram[]): EPGProgram | null {
  const now = new Date();
  return programs.find(p => new Date(p.start_time) > now) || null;
}

export function getProgramProgress(program: EPGProgram): number {
  const now = Date.now();
  const start = new Date(program.start_time).getTime();
  const end = new Date(program.end_time).getTime();
  if (now < start) return 0;
  if (now > end) return 100;
  return ((now - start) / (end - start)) * 100;
}
