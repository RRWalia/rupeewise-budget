import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Loader2, MessageSquare, CheckCircle2, XCircle, ExternalLink, Trash2, Smartphone, ShieldCheck, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSharedTransactions } from '@/contexts/TransactionsContext';

/** navigator.clipboard fails silently in some older Android WebViews — fall back to execCommand. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Wrap a CSV field in double quotes when it contains commas, quotes or newlines. */
function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type BotChat = {
  id: string;
  status: string;
  bot_username: string | null;
  bind_code: string | null;
  webhook_secret: string | null;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://cuvhhjkhebfpnrixmxxq.supabase.co';

const Settings = () => {
  const [botChat, setBotChat] = useState<BotChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const loadBotChat = useCallback(async () => {
    const { data, error } = await supabase
      .from('bot_chats')
      .select('id, status, bot_username, bind_code, webhook_secret, created_at')
      .eq('provider', 'telegram')
      .neq('status', 'disabled')
      .maybeSingle();
    if (error) {
      toast({ title: 'Could not load bot status', description: error.message, variant: 'destructive' });
    }
    setBotChat(data as BotChat | null);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadBotChat();
    // Re-check when the user comes back from Telegram.
    const onFocus = () => loadBotChat();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadBotChat]);

  const handleConnect = async () => {
    const botToken = token.trim();
    if (!botToken) {
      toast({ title: 'Paste your bot token first', variant: 'destructive' });
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-connect', {
        body: { botToken },
      });
      if (error) {
        toast({ title: 'Connect failed', description: error.message, variant: 'destructive' });
        return;
      }
      const result = data as { botUsername?: string; error?: string };
      if (result?.error) {
        toast({ title: 'Connect failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Bot @${result?.botUsername ?? 'bot'} linked`, description: 'Now tap the Telegram link to finish setup.' });
      setToken('');
      await loadBotChat();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!botChat) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.from('bot_chats').delete().eq('id', botChat.id);
      if (error) {
        toast({ title: 'Disconnect failed', description: error.message, variant: 'destructive' });
        return;
      }
      setBotChat(null);
      toast({ title: 'Bot disconnected' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopyIngestUrl = async () => {
    if (!botChat?.webhook_secret) return;
    const url = `${SUPABASE_URL}/functions/v1/sms-ingest?s=${botChat.webhook_secret}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Ingest URL copied', description: 'Paste it into your SMS forwarder app as the webhook/URL destination.' });
    } catch {
      toast({ title: 'Copy failed', description: url, variant: 'destructive' });
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Not signed in', description: 'Sign in again to export your transactions.', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase
        .from('transactions')
        .select('date,type,category,amount,payment_mode,note')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(20000);
      if (error) {
        toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        return;
      }
      const rows = data ?? [];
      const header = 'Date,Type,Category,Amount,Payment Mode,Note';
      const lines = rows.map((t) =>
        [
          csvCell(t.date),
          csvCell(t.type),
          csvCell(t.category),
          String(t.amount ?? ''),
          csvCell(t.payment_mode),
          csvCell(t.note),
        ].join(',')
      );
      const csv = '﻿' + [header, ...lines].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      link.href = url;
      link.download = `rupeewise-transactions-${yearMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: `${rows.length} transaction${rows.length === 1 ? '' : 's'} downloaded.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export transactions';
      toast({ title: 'Export failed', description: message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const deepLink =
    botChat?.bot_username && botChat.bind_code
      ? `https://t.me/${botChat.bot_username}?start=${botChat.bind_code}`
      : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="mb-6 text-sm text-muted-foreground">Connections and preferences</p>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <Bot className="h-5 w-5" />
              Telegram Bot
            </CardTitle>
            <CardDescription>
              Log simple expenses by chat. Forwarded bank SMS are held for your approval before anything is added.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
              </div>
            ) : !botChat ? (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Open <span className="font-medium text-foreground">@BotFather</span> in Telegram, send <span className="font-mono text-xs">/newbot</span>, and copy the token it gives you.</li>
                  <li>Paste the token below.</li>
                  <li>Tap the Telegram link we show you and press <span className="font-medium text-foreground">Start</span>.</li>
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="password"
                    placeholder="Bot token, e.g. 123456:ABC-DEF…"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                  />
                  <Button onClick={handleConnect} disabled={connecting || !token.trim()} className="shrink-0">
                    {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Connect
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The token is stored on your RupeeWise database and used only to receive your messages and reply to you.
                </p>
              </>
            ) : botChat.status === 'active' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md bg-income/10 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-income" />
                  <span>
                    Connected as <span className="font-medium">@{botChat.bot_username}</span>
                  </span>
                </div>
                <div className="rounded-md border border-dashed px-3 py-3 text-center">
                  <p className="mb-1 text-xs text-muted-foreground">
                    Message your bot things like <span className="font-mono">Coffee 150</span> — RupeeWise picks the category. Forwarded bank SMS wait for your approval. <span className="font-mono">/undo</span> removes the last chat entry.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    For regular chat entries, words like “salary” or “received” mark the entry as income.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Disconnect bot
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-yellow-600" />
                  <span>Almost there — one tap left in Telegram.</span>
                </div>
                {deepLink && (
                  <Button asChild className="w-full" size="lg">
                    <a href={deepLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open @{botChat.bot_username} in Telegram
                    </a>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  After pressing Start in Telegram, come back here — status updates to Connected automatically.
                </p>
                <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Cancel setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-5">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <Smartphone className="h-5 w-5" />
              Review bank SMS
            </CardTitle>
            <CardDescription>
              Forward matching bank alerts to your connected Telegram bot. RupeeWise will suggest a category, but it will not add the transaction until you approve it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 rounded-md bg-primary/5 px-3 py-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                This web app cannot read your phone's SMS inbox and does not request SMS access. The original SMS text is not saved; RupeeWise keeps only the parsed details needed for review.
              </p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Either auto-forward with the Android setup below, or manually long-press a bank alert in your SMS app and forward it to your connected Telegram bot.</li>
              <li>Forward only transaction alerts from your bank sender IDs (for example, HDFCBK or SBIINB), preserving the amount, date and sender when possible. If the sender is omitted, prefix forwarded text with <span className="font-mono text-foreground">SMS:</span>.</li>
              <li>Matched debit and credit alerts appear in <span className="font-medium text-foreground">Approvals</span>. Check the amount, date and suggested category, then approve, edit or dismiss.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Exclude OTPs, login codes and promotional messages in the forwarder. Identifiable OTP, failed and promotional alerts are ignored, but filtering them on your phone is safest. iPhone does not allow apps to read SMS in the background; use manual entry or statement import there.
            </p>
            {botChat?.status === 'active' && botChat.webhook_secret ? (
              <div className="space-y-3 rounded-md border px-3 py-3">
                <p className="text-sm font-medium">Auto-forward from Android (optional)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In an SMS-forwarding app such as <span className="font-medium text-foreground">SMS Telebot</span> or <span className="font-medium text-foreground">MacroDroid</span>, create a rule: trigger <span className="font-medium text-foreground">SMS received</span> from your bank sender IDs (e.g. HDFCBK, SBIINB) containing “debited” or “credited” (exclude “OTP”), and set the action to an <span className="font-medium text-foreground">HTTP POST</span> to this URL with the SMS text in a <span className="font-mono">text</span> field:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
                    {SUPABASE_URL}/functions/v1/sms-ingest?s=•••{botChat.webhook_secret.slice(-4)}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopyIngestUrl} className="shrink-0">
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy URL
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The URL contains your private ingest key — anyone with it can submit SMS for your review, so keep it to yourself. Matched alerts appear in <span className="font-medium text-foreground">Approvals</span> exactly like forwarded Telegram messages.
                </p>
              </div>
            ) : null}
            {botChat?.status === 'active' ? (
              <Button asChild variant="outline">
                <Link to="/approvals">Review pending SMS</Link>
              </Button>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">Connect your Telegram bot above before setting up forwarding.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-5">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <Download className="h-5 w-5" />
              Export data
            </CardTitle>
            <CardDescription>
              Download all your transactions as a CSV for spreadsheets or tax filing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportCsv} disabled={exporting} variant="outline">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download CSV
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Settings;
