"use client";

import * as React from "react";
import { Icon } from "@/components/admin/icon";
import { Input, cn } from "@/components/ui";

export const CURATED_ICONS = [
  "Wrench", "Hammer", "Drill", "Ruler", "PaintRoller", "Paintbrush", "Brush", "Grid3x3", "LayoutGrid", "Layers", "Mountain", "Bath", "ShowerHead", "Droplets", "Flame", "Zap", "Plug", "Lightbulb", "Sun", "Wind", "Snowflake", "Thermometer", "Home", "Building", "Building2", "Warehouse", "Fence", "DoorOpen", "AppWindow", "Trees", "Leaf", "Flower2", "Sprout", "Shovel", "Truck", "Car", "Bike", "Waves", "Sparkles", "Bomb", "Box", "Boxes", "Package", "Square", "Triangle", "Cog", "Settings", "Shield", "ShieldCheck", "Key", "Lock", "Camera", "Wifi", "Antenna", "Radio", "Cable", "Fan", "Factory", "HardHat", "BrickWall", "Construction",
];

export function IconPicker({ name, value, onChange }: { name: string; value: string; onChange?: (v: string) => void }) {
  const [current, setCurrent] = React.useState(value);
  const [q, setQ] = React.useState("");
  const list = CURATED_ICONS.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
  const set = (v: string) => {
    setCurrent(v);
    onChange?.(v);
  };
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={current} />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-neutral-50"><Icon name={current} className="h-5 w-5" /></span>
        <Input value={current} onChange={(e) => set(e.target.value)} placeholder="Icon name (lucide)" className="max-w-xs" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons…" className="max-w-xs" />
      </div>
      <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-12">
        {list.map((i) => (
          <button key={i} type="button" title={i} onClick={() => set(i)} className={cn("flex h-9 items-center justify-center rounded hover:bg-neutral-100", current === i && "bg-neutral-900 text-white hover:bg-neutral-800")}>
            <Icon name={i} className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
