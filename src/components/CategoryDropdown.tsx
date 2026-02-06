import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { CATEGORY_ICONS, type Category } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import type { AISuggestion } from '@/hooks/useAIAutocomplete';

interface CategoryDropdownProps {
  categories: readonly Category[];
  value: Category | undefined;
  onChange: (value: Category) => void;
  suggestion: AISuggestion | null;
}

export function CategoryDropdown({ categories, value, onChange, suggestion }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="space-y-2" ref={ref}>
      <Label>Category</Label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          suggestion?.category === value && value && 'ring-2 ring-primary/30',
          !value && 'text-muted-foreground'
        )}
      >
        {value ? (
          <span className="flex items-center gap-2">
            <span>{CATEGORY_ICONS[value]}</span>
            {value}
          </span>
        ) : (
          'Select category'
        )}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {open && (
        <div className="relative z-[200]">
          <div className="absolute top-0 left-0 w-full max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                  value === cat && 'bg-accent text-accent-foreground'
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {value === cat && <Check className="h-4 w-4" />}
                </span>
                <span>{CATEGORY_ICONS[cat]}</span>
                {cat}
                {suggestion?.category === cat && (
                  <Sparkles className="ml-auto h-3 w-3 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
