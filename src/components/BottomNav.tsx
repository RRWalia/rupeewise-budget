import { motion } from 'framer-motion';
import { Home, Target, Plus } from 'lucide-react';
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
    { path: '/budget', icon: Target, label: 'Budget' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-lg">
        <div className="relative flex items-end justify-center px-6 pb-4">
          {/* Background bar */}
          <div className="absolute bottom-0 left-4 right-4 h-16 rounded-t-2xl bg-card shadow-lg border border-b-0 border-border" />
          
          {/* Nav items container */}
          <div className="relative flex w-full items-center justify-between px-4">
            {/* Left nav item */}
            <NavItem
              {...navItems[0]}
              isActive={location.pathname === navItems[0].path}
              onClick={() => navigate(navItems[0].path)}
            />

            {/* Center FAB */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddClick}
              className="relative -top-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl"
            >
              <Plus className="h-6 w-6" />
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
        'flex flex-col items-center gap-1 py-2 px-6 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
      {isActive && (
        <motion.div
          layoutId="navIndicator"
          className="absolute -bottom-1 h-0.5 w-8 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
