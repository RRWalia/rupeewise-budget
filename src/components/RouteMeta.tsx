import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'https://rupeewise-budget.lovable.app';

const META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'RupeeWise – Smart Indian Money Tracker',
    description: 'Track UPI, cards, wallets and cash in one simple INR-first view. AI-powered insights help you save more every month.',
  },
  '/budget': {
    title: 'Budget Planning — RupeeWise',
    description: 'Set a monthly budget, see category-wise spending limits and stay on track with RupeeWise.',
  },
  '/auth': {
    title: 'Sign in or Create Account — RupeeWise',
    description: 'Sign in to RupeeWise to track your income, expenses and budgets in rupees.',
  },
  '/reset-password': {
    title: 'Reset Password — RupeeWise',
    description: 'Reset your RupeeWise account password securely.',
  },
};

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = META[pathname] ?? META['/'];
    const url = `${SITE}${pathname}`;
    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [pathname]);

  return null;
}
