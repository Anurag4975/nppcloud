"use client";
import { useEffect, useMemo, useState } from "react";
import { Folder as FolderIcon, Check, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, Modal, cn } from "@/components/ui";
import type { FolderRow } from "@/lib/types";

interface MoveToPickerProps {
  open: boolean;
  /** Id of the folder being moved (null when moving a file). Used to disable
   *  itself and all its descendants — you can't move a folder into itself. */
  sourceFolderId: string | null;
  sourceName: string;
  onClose: () => void;
  onMove: (parentId: string | null) => Promise<void>;
}

function depthOf(folder: FolderRow, byId: Map<string, FolderRow>): number {
  let depth = 0;
  let cur: FolderRow | undefined = folder;
  while (cur?.parent_id && depth < 50) {
    cur = byId.get(cur.parent_id);
    depth++;
  }
  return depth;
}

/**
 * "Move to…" picker — flat, indented folder tree (root first). Fetches all
 * the user's folders via ?all=1, disables the source folder + its descendants
 * when moving a folder. Confirm calls onMove(selectedParentId).
 */
export function MoveToPicker({ open, sourceFolderId, sourceName, onClose, onMove }: MoveToPickerProps) {
  const toast = useToast();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // null = root
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    api.get<{ folders: FolderRow[] }>("/api/files?all=1")
      .then((r) => setFolders(r.folders ?? []))
      .catch(() => setFolders([]));
  }, [open]);

  // Set of ids that must be disabled: source folder + every descendant.
  const disabledIds = useMemo(() => {
    const set = new Set<string>();
    if (!sourceFolderId) return set;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const stack = [sourceFolderId];
    while (stack.length) {
      const id = stack.pop()!;
      set.add(id);
      for (const f of folders) if (f.parent_id === id) stack.push(f.id);
    }
    return set;
  }, [folders, sourceFolderId]);

  const sorted = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    // Sort by path depth so parents always render before children.
    return [...folders].sort((a, b) => depthOf(a, byId) - depthOf(b, byId) || a.name.localeCompare(b.name));
  }, [folders]);

  async function confirm() {
    setMoving(true);
    try {
      await onMove(selected);
      onClose();
    } catch (e) {
      toast((e as ApiError).message, "error");
    } finally {
      setMoving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move "${sourceName}"`}
      description="Choose a destination folder."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} loading={moving}>
            <Check className="h-4 w-4" /> Move here
          </Button>
        </>
      }
    >
      <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-ink-100 p-1.5">
        {/* Root option */}
        <button
          onClick={() => setSelected(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
            selected === null ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"
          )}
        >
          <FolderIcon className="h-4 w-4 text-ink-300" />
          My Files (root)
          {selected === null && <Check className="ml-auto h-3.5 w-3.5" />}
        </button>
        {sorted.map((f) => {
          const byId = new Map(folders.map((x) => [x.id, x]));
          const depth = depthOf(f, byId);
          const disabled = disabledIds.has(f.id);
          const isSelected = selected === f.id;
          return (
            <button
              key={f.id}
              disabled={disabled}
              onClick={() => setSelected(f.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                isSelected ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50",
                disabled && "cursor-not-allowed opacity-30"
              )}
              style={{ paddingLeft: `${10 + depth * 18}px` }}
            >
              <ChevronRight className="h-3 w-3 shrink-0 text-ink-200" />
              <FolderIcon className="h-4 w-4 shrink-0 text-ink-300" />
              <span className="truncate">{f.name}</span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
