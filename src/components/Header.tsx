import { Bell, User } from 'lucide-react';
import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">₹</span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
            RupeeWise
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
