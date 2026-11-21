"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, DataTable, Empty, ErrorBlock, Field, Input, LoadingBlock, PageHeader, Select } from "./ui";
import { qs, useApi } from "@/lib/api-client";
import { addDays, dateTime, istDate } from "@/lib/format";

interface Entry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  ip: string | null;
}

export function AuditPage() {
  const [from, setFrom] = useState(addDays(istDate(), -6));
  const [to, setTo] = useState(istDate());
  const [user, setUser] = useState("");
  const [entity, setEntity] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const params = { from, to, user: user || undefined, entity: entity || undefined, q: search || undefined };
  const { data, error, loading, reload } = useApi<{ entries: Entry[]; users: { id: string; name: string; username: string }[]; entities: string[] }>(`/api/admin/audit${qs(params)}`);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to money, stock, menu, customers, staff and settings — who did it and when. Entries can't be edited or deleted."
        actions={
          <a href={`/api/admin/audit${qs({ ...params, format: "csv" })}`}>
            <Button variant="secondary" icon={<Download size={15} />}>
              CSV
            </Button>
          </a>
        }
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          <Field label="From" htmlFor="au-from">
            <Input id="au-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="au-to">
            <Input id="au-to" type="date" value={to} min={from} max={istDate()} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Who" htmlFor="au-user">
            <Select id="au-user" value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">Anyone</option>
              {(data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area" htmlFor="au-ent">
            <Select id="au-ent" value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">Everything</option>
              {(data?.entities ?? []).map((e) => (
                <option key={e} value={e}>
                  {e.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="au-q" className="min-w-[180px] flex-1">
            <Input id="au-q" value={text} placeholder="e.g. refund, Milk, #1042" onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
        <ErrorBlock error={error} retry={reload} />
        {loading ? (
          <div className="p-4">
            <LoadingBlock rows={8} />
          </div>
        ) : (
          <DataTable
            dense
            rows={data?.entries ?? []}
            rowKey={(e) => String(e.id)}
            onRowClick={(e) => setOpen(open === e.id ? null : e.id)}
            empty={<Empty title="Nothing recorded for these filters" />}
            columns={[
              { key: "w", header: "When", cell: (e) => <span className="whitespace-nowrap">{dateTime(e.at)}</span> },
              { key: "a", header: "Who", cell: (e) => e.actor },
              {
                key: "s",
                header: "What happened",
                primary: true,
                cell: (e) => (
                  <div>
                    <p>{e.summary}</p>
                    {open === e.id && Object.keys(e.details).length > 0 && (
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[12px]">{JSON.stringify(e.details, null, 2)}</pre>
                    )}
                  </div>
                ),
              },
              { key: "e", header: "Area", hideOnCard: true, cell: (e) => <span className="capitalize text-muted">{e.entity.replace(/_/g, " ")}</span> },
            ]}
          />
        )}
        {data && data.entries.length >= 500 && <p className="border-t border-line px-4 py-2 text-[13px] text-muted">Showing the latest 500. Narrow the dates or download the CSV for everything.</p>}
      </Card>
    </>
  );
}
