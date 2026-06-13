import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledger — Personal Expense Tracker" },
      { name: "description", content: "A clean, fast personal expense tracker. Log spending, filter, and see monthly summaries." },
      { property: "og:title", content: "Ledger — Personal Expense Tracker" },
      { property: "og:description", content: "A clean, fast personal expense tracker." },
    ],
  }),
  component: Index,
});

const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Other",
] as const;
type Category = (typeof CATEGORIES)[number];

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: Category;
  date: string; // YYYY-MM-DD
  note?: string;
};

const STORAGE_KEY = "ledger.expenses.v1";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.id === "string");
  } catch {
    return [];
  }
}

type FormState = {
  title: string;
  amount: string;
  category: Category;
  date: string;
  note: string;
};

const emptyForm = (): FormState => ({
  title: "",
  amount: "",
  category: "Food",
  date: todayISO(),
  note: "",
});

function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Filters
  const [fCategory, setFCategory] = useState<string>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fQuery, setFQuery] = useState("");

  useEffect(() => {
    setExpenses(loadExpenses());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses, loaded]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    const title = form.title.trim();
    if (!title) e.title = "Required";
    else if (title.length > 80) e.title = "Max 80 chars";
    const amt = Number(form.amount);
    if (!form.amount || Number.isNaN(amt)) e.amount = "Enter a number";
    else if (amt <= 0) e.amount = "Must be > 0";
    else if (amt > 1_000_000_000) e.amount = "Too large";
    if (!form.date) e.date = "Required";
    else {
      const d = new Date(form.date);
      if (Number.isNaN(d.getTime())) e.date = "Invalid date";
    }
    if (form.note.length > 500) e.note = "Max 500 chars";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload: Expense = {
      id: editingId ?? crypto.randomUUID(),
      title: form.title.trim(),
      amount: Math.round(Number(form.amount) * 100) / 100,
      category: form.category,
      date: form.date,
      note: form.note.trim() || undefined,
    };
    setExpenses((prev) => {
      if (editingId) return prev.map((x) => (x.id === editingId ? payload : x));
      return [payload, ...prev];
    });
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      amount: String(e.amount),
      category: e.category,
      date: e.date,
      note: e.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setErrors({});
  };

  const remove = (id: string) => {
    if (!confirm("Delete this expense?")) return;
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
  };

  const filtered = useMemo(() => {
    const q = fQuery.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (fCategory !== "all" && e.category !== fCategory) return false;
        if (fFrom && e.date < fFrom) return false;
        if (fTo && e.date > fTo) return false;
        if (q && !e.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, fCategory, fFrom, fTo, fQuery]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = expenses.filter((e) => e.date.startsWith(ym));
    const total = inMonth.reduce((s, e) => s + e.amount, 0);
    const byCat = new Map<Category, number>();
    for (const e of inMonth) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    const breakdown = CATEGORIES.map((c) => ({ cat: c, amount: byCat.get(c) ?? 0 })).filter(
      (x) => x.amount > 0,
    );
    return { total, breakdown, ym, count: inMonth.length };
  }, [expenses]);

  const clearFilters = () => {
    setFCategory("all");
    setFFrom("");
    setFTo("");
    setFQuery("");
  };

  const hasFilters = fCategory !== "all" || fFrom || fTo || fQuery;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Ledger</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A quiet place to track what you spend.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                This month
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatMoney(monthSummary.total)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-8">
          {/* Form */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {editingId ? "Edit expense" : "Add expense"}
              </h2>
              {editingId && (
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Coffee at Starbucks"
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                {errors.amount && (
                  <p className="mt-1 text-xs text-destructive">{errors.amount}</p>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  max={todayISO()}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  rows={2}
                  maxLength={500}
                  placeholder="Anything worth remembering"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                {errors.note && <p className="mt-1 text-xs text-destructive">{errors.note}</p>}
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit">
                  <Plus className="mr-1 h-4 w-4" />
                  {editingId ? "Save changes" : "Add expense"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Filters */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Expenses</h2>
              <span className="text-sm text-muted-foreground">
                {filtered.length} of {expenses.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 mb-5">
              <Input
                placeholder="Search title…"
                value={fQuery}
                onChange={(e) => setFQuery(e.target.value)}
              />
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                aria-label="To date"
              />
            </div>
            {hasFilters && (
              <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" /> Clear filters
                </Button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                {expenses.length === 0
                  ? "No expenses yet — add your first above."
                  : "Nothing matches those filters."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((e) => (
                  <li key={e.id} className="flex items-start gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{e.title}</span>
                        <Badge variant="secondary" className="font-normal">
                          {e.category}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      {e.note && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {e.note}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{formatMoney(e.amount)}</div>
                      <div className="mt-1 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(e)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => remove(e.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <h2 className="text-lg font-medium">Monthly summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(monthSummary.ym + "-01T00:00:00").toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}{" "}
              · {monthSummary.count} {monthSummary.count === 1 ? "entry" : "entries"}
            </p>
            <div className="mt-4 text-3xl font-semibold tabular-nums">
              {formatMoney(monthSummary.total)}
            </div>
            <div className="mt-6 space-y-3">
              {monthSummary.breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spending this month yet.</p>
              ) : (
                monthSummary.breakdown.map((b) => {
                  const pct = monthSummary.total
                    ? (b.amount / monthSummary.total) * 100
                    : 0;
                  return (
                    <div key={b.cat}>
                      <div className="flex justify-between text-sm">
                        <span>{b.cat}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatMoney(b.amount)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <p className="text-xs text-muted-foreground px-1">
            Data is stored locally in your browser. Clearing site data will erase it.
          </p>
        </aside>
      </main>
    </div>
  );
}
