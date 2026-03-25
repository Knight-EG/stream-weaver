import { Heart, Layers, Radio } from 'lucide-react';

interface CategorySidebarProps {
  categories: string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
  favoriteCount: number;
}

export function CategorySidebar({ categories, selected, onSelect, favoriteCount }: CategorySidebarProps) {
  return (
    <div className="w-full space-y-1 overflow-y-auto scrollbar-hide">
      <button
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm tv-focusable transition-colors ${
          selected === null ? 'bg-primary/20 text-primary' : 'text-foreground/70 hover:bg-secondary'
        }`}
        onClick={() => onSelect(null)}
        data-focusable="true"
      >
        <Radio className="w-4 h-4" />
        <span>All Channels</span>
      </button>

      {favoriteCount > 0 && (
        <button
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm tv-focusable transition-colors ${
            selected === '__favorites__' ? 'bg-primary/20 text-primary' : 'text-foreground/70 hover:bg-secondary'
          }`}
          onClick={() => onSelect('__favorites__')}
          data-focusable="true"
        >
          <Heart className="w-4 h-4" />
          <span>Favorites</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">{favoriteCount}</span>
        </button>
      )}

      <div className="pt-2 pb-1 px-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-2">
          <Layers className="w-3 h-3" /> Categories
        </p>
      </div>

      {categories.map(cat => (
        <button
          key={cat}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm tv-focusable transition-colors ${
            selected === cat ? 'bg-primary/20 text-primary' : 'text-foreground/70 hover:bg-secondary'
          }`}
          onClick={() => onSelect(cat)}
          data-focusable="true"
        >
          <span className="truncate">{cat}</span>
        </button>
      ))}
    </div>
  );
}
