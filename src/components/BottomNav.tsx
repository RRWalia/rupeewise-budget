import { motion } from 'framer-motion';
import { Home, PieChart, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onAddClick: () => void;
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/budget', icon: PieChart, label: 'Budget' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-lg">
        <div className="relative flex items-end justify-center px-6 pb-4">
          {/* Background bar */}
          <div className="absolute bottom-0 left-4 right-4 h-[72px] rounded-t-3xl bg-card shadow-lg border border-b-0 border-border" />
          
          {/* Nav items container */}
          <div className="relative flex w-full items-center justify-between px-6">
            {/* Left nav item */}
            <NavItem
              {...navItems[0]}
              isActive={location.pathname === navItems[0].path}
              onClick={() => navigate(navItems[0].path)}
            />

            {/* Center FAB - Larger and more prominent */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddClick}
              className="relative -top-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background transition-shadow hover:shadow-2xl"
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </motion.button>

            {/* Right nav item */}
            <NavItem
              {...navItems[1]}
              isActive={location.pathname === navItems[1].path}
              onClick={() => navigate(navItems[1].path)}
            />
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
      className={cn(
        'flex flex-col items-center gap-1 py-3 px-8 transition-colors relative',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.5]')} />
      <span className={cn('text-xs', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
      {isActive && (
        <motion.div
          layoutId="navIndicator"
          className="absolute -bottom-0.5 h-1 w-10 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
