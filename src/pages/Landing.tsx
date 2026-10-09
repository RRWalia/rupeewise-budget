import { ArrowRight, CheckCircle2, IndianRupee, MessageSquare, PieChart, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Wallet,
    title: 'Track everyday spending',
    description: 'Log income and expenses made with UPI, cards, wallets or cash. See your transactions together in one INR-first view.',
  },
  {
    icon: PieChart,
    title: 'Plan a monthly budget',
    description: 'Set a monthly budget, review category-wise spending and spot how this month compares with the last.',
  },
  {
    icon: Sparkles,
    title: 'Find useful saving insights',
    description: 'Get AI-assisted summaries based on your spending so you can spot patterns and make more informed choices.',
  },
];

const steps = [
  'Add income and expenses as they happen, or log them through the optional Telegram bot.',
  'Set a monthly budget and review spending by category in your dashboard.',
  'Use trends and optional bank-alert forwarding to stay on top of your money. Forwarded alerts wait for your approval before they become transactions.',
];

const faqs = [
  {
    question: 'Does RupeeWise connect directly to my bank or UPI account?',
    answer: 'No. RupeeWise does not directly connect to bank accounts or automatically import UPI transactions. You can enter transactions yourself or use the optional Telegram bot to log them.',
  },
  {
    question: 'Can RupeeWise read my phone SMS inbox?',
    answer: 'No. The web app cannot read your SMS inbox. If you choose, a separate phone-side forwarding tool can send selected bank alerts to the Telegram bot. Those alerts stay pending until you review and approve them in RupeeWise.',
  },
  {
    question: 'Can I track cash, card and UPI expenses?',
    answer: 'Yes. You can record expenses made with cash, cards, UPI and wallets, then review them alongside your monthly budget and category totals.',
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5" aria-label="RupeeWise home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <IndianRupee className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">RupeeWise</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQs</a>
          </nav>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <section id="top" className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
              <IndianRupee className="h-4 w-4" aria-hidden="true" />
              Personal finance, made for India
            </p>
            <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              A simpler expense tracker and budget planner for India
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Record everyday spending across UPI, cards, wallets and cash. Plan a monthly budget, review category trends and get AI-assisted saving insights in one INR-first finance app.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/auth">
                  Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <a href="#features">Explore features</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No direct bank connection. You stay in control of what you record.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your money, at a glance</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Monthly overview</h2>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <IndianRupee className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Income</p>
                  <p className="mt-2 text-lg font-semibold">Monthly total</p>
                  <div className="mt-3 h-1.5 rounded-full bg-primary/15"><div className="h-1.5 w-3/4 rounded-full bg-primary" /></div>
                </div>
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expenses</p>
                  <p className="mt-2 text-lg font-semibold">By category</p>
                  <div className="mt-3 h-1.5 rounded-full bg-orange-100"><div className="h-1.5 w-1/2 rounded-full bg-orange-400" /></div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PieChart className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Budget progress</p>
                    <p className="text-sm text-muted-foreground">See how spending adds up this month</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
                <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="text-sm">Clear spending trends and helpful saving insights, all in one place.</p>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">A preview of the RupeeWise experience</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Simple money management</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              An expense tracker built around everyday spending in India
            </h2>
            <p className="mt-4 text-muted-foreground">
              Keep income, expenses and monthly budgets together, whether you paid by UPI, card, wallet or cash.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">A clearer view of your money, one step at a time</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            RupeeWise is a personal budget planner and expense tracker for people who want a straightforward way to review their monthly finances.
          </p>
        </div>
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <p className="leading-7 text-muted-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-primary/5">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">You stay in control</p>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">Bank alerts are optional and always reviewed by you</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              RupeeWise does not read your phone&apos;s SMS inbox. If you choose to forward selected bank alerts through a separate tool, each suggestion waits in Approvals until you review and approve it.
            </p>
          </div>
          <MessageSquare className="hidden h-16 w-16 text-primary/30 md:block" aria-hidden="true" />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">FAQs</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">RupeeWise, explained</h2>
        </div>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-7">
          {faqs.map(({ question, answer }) => (
            <details key={question} className="group py-5">
              <summary className="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {question}
                  <span className="text-xl font-normal text-primary transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </span>
              </summary>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-foreground px-6 py-9 text-background sm:px-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold">Start with a clearer picture of your finances</h2>
            <p className="mt-2 text-background/70">Track spending, plan your budget and review your month in RupeeWise.</p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link to="/auth">Sign in or create an account <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} RupeeWise. Personal finance tracking in Indian rupees.</p>
          <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
