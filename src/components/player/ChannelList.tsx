import { memo } from 'react';
import { Heart, Play, Tv } from 'lucide-react';
import type { Channel } from '@/lib/m3u-parser';

interface ChannelListProps {
  channels: Channel[];
  activeId?: string;
  favorites: Set<string>;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
}

const ChannelItem = memo(({ channel, isActive, isFav, onSelect, onToggleFav }: {
  channel: Channel;
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer tv-focusable transition-colors ${
      isActive ? 'bg-primary/20 border border-primary/30' : 'hover:bg-secondary'
    }`}
    onClick={onSelect}
    onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
    data-focusable="true"
    tabIndex={0}
    role="button"
  >
    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
      {channel.logo ? (
        <img src={channel.logo} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Tv className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-foreground text-sm font-medium truncate">{channel.name}</p>
      {channel.group && <p className="text-muted-foreground text-xs truncate">{channel.group}</p>}
    </div>
    {isActive && <Play className="w-4 h-4 text-primary flex-shrink-0" />}
    <button
      onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
      className="p-1 tv-focusable rounded"
      data-focusable="true"
      tabIndex={0}
    >
      <Heart className={`w-4 h-4 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
    </button>
  </div>
));

ChannelItem.displayName = 'ChannelItem';

export function ChannelList({ channels, activeId, favorites, onSelect, onToggleFavorite }: ChannelListProps) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Tv className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No channels found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto scrollbar-hide max-h-[calc(100vh-200px)]">
      {channels.map(ch => (
        <ChannelItem
          key={ch.id}
          channel={ch}
          isActive={ch.id === activeId}
          isFav={favorites.has(ch.id)}
          onSelect={() => onSelect(ch)}
          onToggleFav={() => onToggleFavorite(ch.id)}
        />
      ))}
    </div>
  );
}
