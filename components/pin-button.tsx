"use client";

import { useSyncExternalStore } from "react";

import {
  addToCollection,
  isInCollection,
  removeFromCollection,
  subscribeToCollection,
} from "@/lib/collection-store";

type PinButtonProps = {
  instrumentSlug: string;
  segmentId: string;
  label: string;
};

export function PinButton({ instrumentSlug, segmentId, label }: PinButtonProps) {
  const pinned = useSyncExternalStore(
    subscribeToCollection,
    () => isInCollection(instrumentSlug, segmentId),
    () => false,
  );

  const handleClick = () => {
    if (pinned) {
      removeFromCollection(instrumentSlug, segmentId);
    } else {
      addToCollection(instrumentSlug, segmentId);
    }
  };

  return (
    <button
      aria-label={pinned ? `Unpin ${label} from collection` : `Pin ${label} to collection`}
      className={`pin-button ${pinned ? "pin-button--pinned" : ""}`}
      onClick={handleClick}
      title={pinned ? "Remove from collection" : "Add to collection"}
      type="button"
    >
      {pinned ? "✓" : "+"}
    </button>
  );
}
