"use client";

import { useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { Card, DataTable, Empty, ErrorBlock, Field, Input, LoadingBlock, PageHeader, Select, Stat } from "./ui";
import { qs, useApi } from "@/lib/api-client";
import { addDays, dateTime, istDate } from "@/lib/format";

interface Row {
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  number: number;
  type: string;
  customer_name: string;
  table_label: string | null;
  items: string | null;
}
interface Data {
  total: number;
  average: number | null;
  spread: { rating: number; count: number }[];
  feedback: Row[];
}

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={14} className={i <= n ? "fill-[#C29545] text-[#C29545]" : "text-line-strong"} aria-hidden />
    ))}
  </span>
);

export function FeedbackPage() {
  const [from, setFrom] = useState(addDays(istDate(), -29));
  const [to, setTo] = useState(istDate());
  const [rating, setRating] = useState("");
  const { data, error, loading, reload } = useApi<Data>(`/api/admin/feedback${qs({ from, to, rating: rating || undefined })}`);
  const max = Math.max(1, ...(data?.spread.map((s) => s.count) ?? [0]));
  const low = data ? data.spread.filter((s) => s.rating <= 2).reduce((a, s) => a + s.count, 0) : 0;
  const withComment = data?.feedback.filter((f) => f.comment).length ?? 0;

  return (
    <>
      <PageHeader title="Guest feedback" description="Ratings guests leave on their order page after it's served. Low ratings with a comment are worth a call back." />
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-2 p-3">
          <Field label="From" htmlFor="fb-from">
            <Input id="fb-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="fb-to">
            <Input id="fb-to" type="date" value={to} min={from} max={istDate()} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Rating" htmlFor="fb-r">
            <Select id="fb-r" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">All</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} star{r > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      <ErrorBlock error={error} retry={reload} />
      {loading && !data ? (
        <LoadingBlock />
      ) : data ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Average rating" value={data.average === null ? "—" : `${data.average.toFixed(1)} / 5`} />
              <Stat label="Ratings" value={data.total} />
              <Stat label="1–2 stars" value={low} tone={low ? "warning" : "default"} />
              <Stat label="With a comment" value={withComment} />
            </div>
            <Card title="Spread">
              <ul className="space-y-2">
                {[...data.spread].reverse().map((s) => (
                  <li key={s.rating} className="grid grid-cols-[56px_1fr_40px] items-center gap-3 text-[13.5px]">
                    <span className="font-semibold">{s.rating} ★</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(s.count / max) * 100}%` }} />
                    </span>
                    <span className="num text-right text-muted">{s.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="What guests said" padded={false}>
            <DataTable
              rows={data.feedback}
              rowKey={(r) => r.order_id}
              empty={<Empty icon={<MessageSquareText size={22} />} title="No feedback in this period">Guests can rate an order once it&apos;s served, for up to 3 days.</Empty>}
              columns={[
                { key: "r", header: "Rating", cell: (r) => <Stars n={r.rating} /> },
                { key: "c", header: "Comment", primary: true, cell: (r) => (r.comment ? <span>“{r.comment}”</span> : <span className="text-muted">No comment</span>) },
                { key: "o", header: "Order", cell: (r) => <span className="num">#{r.number}{r.table_label ? ` · Table ${r.table_label}` : " · Takeaway"}</span> },
                { key: "i", header: "Items", hideOnCard: true, cell: (r) => <span className="text-[13px] text-muted">{r.items}</span> },
                { key: "g", header: "Guest", cell: (r) => r.customer_name || "—" },
                { key: "t", header: "When", cell: (r) => <span className="text-[13px]">{dateTime(r.created_at)}</span> },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
