"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Loader2, Plus } from "lucide-react";
import {
  DrmFormActions,
  DrmInlineActions,
  DrmSection,
  TargetSystemShell,
  TsFormGrid,
  drmFieldClass,
  tsSelectTriggerClass,
} from "@/modules/target-system/target-system-ui";

function StepperInput({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="flex w-full">
      <Button
        type="button"
        variant="secondary"
        className="rounded-r-none px-3"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </Button>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${drmFieldClass} rounded-none text-center`}
      />
      <Button type="button" variant="secondary" className="rounded-l-none px-3" onClick={() => onChange(value + 1)}>
        +
      </Button>
    </div>
  );
}

export function CreateTargetPage() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [targetName, setTargetName] = useState("");
  const [category, setCategory] = useState("none");
  const [pkg, setPkg] = useState("");
  const [reward, setReward] = useState(0);
  const [bonus, setBonus] = useState("");
  const [price, setPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [penalty, setPenalty] = useState(100);
  const [amount, setAmount] = useState("");
  const [number, setNumber] = useState(0);
  const [kwa, setKwa] = useState(0);
  const [vas, setVas] = useState(0);
  const [conversion, setConversion] = useState(0);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["/api/target-system/targets"],
    queryFn: async () => {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/target-system/targets", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch targets");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newTarget: Record<string, unknown>) => {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/target-system/targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newTarget),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create target");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/targets"] });
      toast({ title: "Target created successfully" });
      setTargetName("");
      setCategory("none");
      setPkg("");
      setReward(0);
      setBonus("");
      setPrice(0);
      setMaxPrice(0);
      setPenalty(100);
      setAmount("");
      setNumber(0);
      setKwa(0);
      setVas(0);
      setConversion(0);
      setShowForm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating target", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!targetName) {
      toast({ title: "Target Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      targetName,
      category: category === "none" ? undefined : category,
      package: pkg,
      reward,
      bonus,
      price,
      maxPrice,
      penalty,
      amount,
      number,
      kwa,
      vas,
      conversion,
    });
  };

  const columns = useMemo((): DataTableColumn<any>[] => {
    return [
      {
        id: "idx",
        header: "#",
        cell: (row) => <span className="tabular-nums text-zinc-500">{row.id}</span>,
        className: "w-12",
      },
      { id: "name", header: "Target name", cell: (row) => <span className="font-medium">{row.targetName}</span> },
      { id: "category", header: "Category", cell: (row) => row.category || "—" },
      { id: "number", header: "Number", cell: (row) => <span className="tabular-nums">{row.number}</span> },
      {
        id: "price",
        header: "Price",
        cell: (row) => <span className="tabular-nums">{row.price ?? row.amount ?? "—"}</span>,
      },
      { id: "bonus", header: "Bonus", cell: (row) => row.bonus || "—" },
      { id: "package", header: "Package", cell: (row) => (row.package === "none" ? "—" : row.package) },
      {
        id: "reward",
        header: "Reward",
        cell: (row) => (row.bonus === "Percentage %" ? `${row.reward}%` : row.reward),
      },
      { id: "kwa", header: "KWA", cell: (row) => row.kwa },
      { id: "vas", header: "VAS", cell: (row) => row.vas },
      { id: "conversion", header: "Conversion", cell: (row) => row.conversion },
      {
        id: "created",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500">
            {format(new Date(row.createdAt), "dd MMM yyyy hh:mm a")}
          </span>
        ),
      },
    ];
  }, []);

  return (
    <TargetSystemShell title="Create target" description="Define target types, rewards, and packages.">
      <DrmInlineActions
        items={[
          {
            id: "create-form",
            label: showForm ? "Hide create form" : "New target",
            active: showForm,
            onClick: () => setShowForm((v) => !v),
          },
        ]}
      />

      {showForm && (
        <DrmSection title="Create target" description="Fill in target definition fields.">
          <div className="space-y-4">
            <TsFormGrid cols={5}>
              <Field id="ts-name" label="Target name">
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Target name"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ts-category" label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose…</SelectItem>
                    <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                    <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                    <SelectItem value="VAS">VAS</SelectItem>
                    <SelectItem value="Team">Team</SelectItem>
                    <SelectItem value="Dep DD">Dep DD</SelectItem>
                    <SelectItem value="Dep PP">Dep PP</SelectItem>
                    <SelectItem value="PP Link">PP Link</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="ts-package" label="Package">
                <Select value={pkg} onValueChange={setPkg}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose…</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Basic Plus">Basic Plus</SelectItem>
                    <SelectItem value="GGS Digital">GGS Digital</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Verified Supplier">Verified Supplier</SelectItem>
                    <SelectItem value="Kwa">Kwa</SelectItem>
                    <SelectItem value="Cat">Cat</SelectItem>
                    <SelectItem value="Ai">Ai</SelectItem>
                    <SelectItem value="Psa">Psa</SelectItem>
                    <SelectItem value="SA">SA</SelectItem>
                    <SelectItem value="Rc-Up">Rc-Up</SelectItem>
                    <SelectItem value="KAP">KAP</SelectItem>
                    <SelectItem value="GGS Pro">GGS Pro</SelectItem>
                    <SelectItem value="KWA-KAP">KWA-KAP</SelectItem>
                    <SelectItem value="China Trip">China Trip</SelectItem>
                    <SelectItem value="Kwa-Pro">Kwa-Pro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="ts-reward" label="Reward">
                <StepperInput value={reward} onChange={setReward} />
              </Field>
              <Field id="ts-bonus" label="Bonus">
                <Select value={bonus} onValueChange={setBonus}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose…</SelectItem>
                    <SelectItem value="Amount">Amount</SelectItem>
                    <SelectItem value="Percentage %">Percentage %</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </TsFormGrid>

            <TsFormGrid cols={5}>
              <Field id="ts-price" label="Price">
                <StepperInput value={price} onChange={setPrice} />
              </Field>
              <Field id="ts-max-price" label="Max price">
                <StepperInput value={maxPrice} onChange={setMaxPrice} />
              </Field>
              <Field id="ts-penalty" label="Penalty">
                <Input
                  type="number"
                  value={penalty}
                  onChange={(e) => setPenalty(Number(e.target.value))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ts-amount" label="Amount">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount name"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ts-quota" label="Number (quota)">
                <Input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(Number(e.target.value))}
                  className={drmFieldClass}
                />
              </Field>
            </TsFormGrid>

            <TsFormGrid cols={4}>
              <Field id="ts-conversion" label="Conversion">
                <Input
                  type="number"
                  value={conversion}
                  onChange={(e) => setConversion(Number(e.target.value))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ts-kwa" label="KWA">
                <Input
                  type="number"
                  value={kwa}
                  onChange={(e) => setKwa(Number(e.target.value))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ts-vas" label="VAS">
                <Input
                  type="number"
                  value={vas}
                  onChange={(e) => setVas(Number(e.target.value))}
                  className={drmFieldClass}
                />
              </Field>
            </TsFormGrid>

            <DrmFormActions>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </DrmFormActions>
          </div>
        </DrmSection>
      )}

      <DrmSection
        title="Target definitions"
        description={isLoading ? "Loading…" : `${targets.length} target${targets.length === 1 ? "" : "s"}`}
      >
        <DataTable
          columns={columns}
          rows={targets}
          rowKey={(row) => String(row.id)}
          loading={isLoading}
          emptyMessage="No targets found. Create one above."
          className="min-w-[960px]"
        />
      </DrmSection>
    </TargetSystemShell>
  );
}
