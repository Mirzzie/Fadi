"use client";

import { Eye, EyeOff, Film, GripVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isVideoUrl } from "@/lib/portfolio/upload";
import type { PortfolioItemView } from "@careeros/portfolio";

/** One draggable content row in the CMS list. */
export function ItemCard({
  item,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: PortfolioItemView;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`flex items-start gap-3 rounded-md border border-border bg-muted/20 p-4 transition-colors hover:border-primary/50 ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <span
        className="mt-1 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-5" />
      </span>
      {item.imageUrl &&
        (isVideoUrl(item.imageUrl) ? (
          <div className="flex size-16 items-center justify-center rounded bg-muted">
            <Film className="size-6 text-muted-foreground" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="size-16 rounded object-cover" />
        ))}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-medium">{item.title}</p>
          {!item.isPublished && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Draft
            </span>
          )}
          {item.tag && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {item.tag}
            </span>
          )}
        </div>
        {(item.subtitle || item.location || item.dateRange) && (
          <p className="text-xs text-muted-foreground">
            {[item.subtitle, item.location, item.dateRange].filter(Boolean).join(" · ")}
          </p>
        )}
        {item.roles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.roles.map((r) => (
              <span
                key={r}
                className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {r}
              </span>
            ))}
          </div>
        )}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{item.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onTogglePublish}
          title={item.isPublished ? "Unpublish" : "Publish"}
        >
          {item.isPublished ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} title="Edit">
          <Pencil className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
