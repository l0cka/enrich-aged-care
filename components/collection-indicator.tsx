"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { getCollectionCount, subscribeToCollection } from "@/lib/collection-store";

import { CollectionDrawer } from "./collection-drawer";

export function CollectionIndicator() {
  const count = useSyncExternalStore(subscribeToCollection, getCollectionCount, () => 0);

  const [open, setOpen] = useState(false);

  if (count === 0 && !open) {
    return null;
  }

  return (
    <>
      <button
        aria-label={`Collection: ${count} item${count === 1 ? "" : "s"}`}
        className="collection-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        Collection ({count})
      </button>
      {open
        ? createPortal(
            <CollectionDrawer onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </>
  );
}
