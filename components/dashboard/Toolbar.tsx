"use client";
import { Search, LayoutGrid, List, ChevronDown, FolderPlus, Upload, ArrowUpDown } from "lucide-react";
import { Input, DropdownMenu, Tooltip, cn } from "@/components/ui";

export type SortKey = "name" | "size" | "created_at";
export type ViewMode = "list" | "grid";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "created_at", label: "Date modified" },
];

interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
  onNewFolder: () => void;
  onUpload: () => void;
}

export function Toolbar({
  search,
  onSearch,
  view,
  onViewChange,
  sortKey,
  onSortChange,
  onNewFolder,
  onUpload,
}: ToolbarProps) {
  const currentSort = SORT_OPTIONS.find((s) => s.value === sortKey);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="min-w-[200px] flex-1 sm:max-w-xs">
        <Input
          id="global-search-input"
          icon={<Search className="h-4 w-4" />}
          placeholder="Search in this folder…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9 text-[13px]"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Sort */}
        <DropdownMenu
          label="Sort by"
          trigger={
            <span className="flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-xs font-medium text-ink-600 shadow-soft transition-all hover:border-ink-300 hover:text-ink-900">
              <ArrowUpDown className="h-3.5 w-3.5 text-ink-400" />
              <span className="hidden sm:inline">{currentSort?.label}</span>
              <ChevronDown className="h-3 w-3 text-ink-400" />
            </span>
          }
          triggerClassName="!p-0 !rounded-xl"
          items={SORT_OPTIONS.map((s) => ({
            label: s.label,
            onClick: () => onSortChange(s.value),
          }))}
        />

        {/* View toggle */}
        <div className="flex items-center rounded-xl border border-ink-200 bg-white p-0.5 shadow-soft">
          <Tooltip label="List view">
            <button
              onClick={() => onViewChange("list")}
              aria-label="List view"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
                view === "list" ? "bg-ink-900 text-white shadow-soft" : "text-ink-400 hover:text-ink-700"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Grid view">
            <button
              onClick={() => onViewChange("grid")}
              aria-label="Grid view"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
                view === "grid" ? "bg-ink-900 text-white shadow-soft" : "text-ink-400 hover:text-ink-700"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        <button
          onClick={onNewFolder}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 shadow-soft transition-all duration-150 hover:border-ink-300 hover:bg-ink-50 active:scale-[0.98]"
        >
          <FolderPlus className="h-3.5 w-3.5 text-ink-500" />
          <span className="hidden sm:inline">New folder</span>
        </button>

        <button
          onClick={onUpload}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-soft transition-all duration-150 hover:bg-brand-500 hover:shadow-glow active:scale-[0.98]"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>
    </div>
  );
}
