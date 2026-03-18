"use client";

import { showToast } from "@/components/toast";
import { addBulk } from "@/lib/collection-store";

type AddChainButtonProps = {
  items: { instrumentSlug: string; segmentId: string }[];
};

export function AddChainButton({ items }: AddChainButtonProps) {
  const handleClick = () => {
    const added = addBulk(items);

    if (added > 0) {
      showToast(`Added ${added} provision${added === 1 ? "" : "s"} to collection`);
    } else {
      showToast("All provisions already in collection", "error");
    }
  };

  return (
    <button className="button button--secondary" onClick={handleClick} type="button">
      Add chain to collection
    </button>
  );
}
