import { motion } from 'framer-motion';
import { Home, PieChart, Plus, Settings, Inbox } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onAddClick: () => void;
}

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/budget', icon: PieChart, label: 'Budget' },
  { path: '/approvals', icon: Inbox, label: 'Approvals' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav({ onAddClick }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const renderItem = ({ path, ...item }: typeof navItems[number]) => (
    <NavItem
      key={path}
      {...item}
      isActive={location.pathname === path}
      onClick={() => navigate(path)}
    />
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-lg">
        <div className="relative flex items-end justify-center px-4 pb-4">
          <div className="absolute bottom-0 left-3 right-3 h-[72px] rounded-t-3xl border border-b-0 border-border bg-card shadow-lg" />

          <div className="relative flex w-full items-center justify-between gap-1">
            <div className="flex min-w-0 flex-1 items-center justify-around">
              {navItems.slice(0, 2).map(renderItem)}
            </div>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddClick}
              aria-label="Add transaction"
              className="relative -top-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background transition-shadow hover:shadow-2xl"
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </motion.button>

            <div className="flex min-w-0 flex-1 items-center justify-around">
              {navItems.slice(2).map(renderItem)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1 px-1 py-3 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
      <span className={cn('text-[10px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
      {isActive && (
        <motion.div
          layoutId="navIndicator"
          className="absolute -bottom-0.5 h-1 w-8 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
