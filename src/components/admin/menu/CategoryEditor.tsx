"use client";

import { useState } from "react";
import { Button, Checkbox, Dialog, Field, Input, Notice, Select, Textarea, useToast } from "../ui";
import { apiFetch, type ClientApiError } from "@/lib/api-client";
import type { AdminCategory } from "./types";

const ARTS = ["tea", "coffee", "soda", "iced", "chaat", "eggs", "omelette", "sandwich", "wrap", "rice", "oats", "shake", "icecream"];

export function CategoryEditor({ category, onClose, onSaved }: { category: AdminCategory | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [art, setArt] = useState(category?.art_kind ?? "coffee");
  const [active, setActive] = useState(category?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { name, description, art_kind: art, is_active: active };
      if (category) await apiFetch(`/api/admin/menu/categories/${category.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/menu/categories", { body });
      toast("Category saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    try {
      await apiFetch(`/api/admin/menu/categories/${category.id}`, { method: "DELETE" });
      toast("Category removed");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={category ? "Edit category" : "Add category"}
      footer={
        <>
          {category && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="space-y-3">
        <Field label="Name" htmlFor="c-name">
          <Input id="c-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Short note" htmlFor="c-desc" optional hint="Shown under the category heading on the menu.">
          <Textarea id="c-desc" rows={2} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Illustration" htmlFor="c-art" hint="Used for items without a photo.">
          <Select id="c-art" value={art} onChange={(e) => setArt(e.target.value)}>
            {ARTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox label="Show this category on the menu" checked={active} onChange={setActive} />
      </div>
    </Dialog>
  );
}
