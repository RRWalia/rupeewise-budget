import { Sparkles } from 'lucide-react';
import { CATEGORY_ICONS, type Category } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import type { AISuggestion } from '@/hooks/useAIAutocomplete';

interface CategoryDropdownProps {
  categories: readonly Category[];
  value: Category | undefined;
  onChange: (value: Category) => void;
  suggestion: AISuggestion | null;
  error?: string;
}

export function CategoryDropdown({ categories, value, onChange, suggestion, error }: CategoryDropdownProps) {
  return (
    <div className="space-y-2">
      <Label>Category</Label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              onChange(val as Category);
            }
          }}
          className={cn(
            'flex h-10 w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-destructive ring-destructive/30' : 'border-input',
            suggestion?.category === value && value && 'ring-2 ring-primary/30',
            !value && 'text-muted-foreground'
          )}
          aria-invalid={!!error}
          aria-describedby={error ? 'category-error' : undefined}
        >
          <option value="" disabled>Select category</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_ICONS[cat]} {cat}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>
      {error && (
        <p id="category-error" className="text-xs text-destructive">{error}</p>
      )}
      {suggestion?.category && !error && (
        <button
          type="button"
          onClick={() => onChange(suggestion.category as Category)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="h-3 w-3 text-primary" />
          AI suggests: {suggestion.category}
        </button>
      )}
    </div>
  );
}
