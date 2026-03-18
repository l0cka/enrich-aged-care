"use client";

import { useState } from "react";

import { showToast } from "@/components/toast";
import { saveUserMap } from "@/lib/maps-store";
import type { PathwayMap } from "@/lib/types";

type MapEditorProps = {
  map: PathwayMap;
  onSave: (map: PathwayMap) => void;
};

export function MapEditor({ map, onSave }: MapEditorProps) {
  const [editingMap, setEditingMap] = useState<PathwayMap>(structuredClone(map));

  const moveProvision = (sectionIndex: number, fromIndex: number, toIndex: number) => {
    const updated = structuredClone(editingMap);
    const provisions = updated.sections[sectionIndex].provisions;
    const [item] = provisions.splice(fromIndex, 1);
    provisions.splice(toIndex, 0, item);
    setEditingMap(updated);
  };

  const removeProvision = (sectionIndex: number, provisionIndex: number) => {
    const updated = structuredClone(editingMap);
    updated.sections[sectionIndex].provisions.splice(provisionIndex, 1);
    setEditingMap(updated);
  };

  const handleSave = () => {
    saveUserMap(editingMap);
    onSave(editingMap);
    showToast("Map saved");
  };

  return (
    <div className="map-editor">
      <div className="map-editor__header">
        <h3>Editing: {editingMap.title}</h3>
        <button className="button button--primary" onClick={handleSave} type="button">
          Save
        </button>
      </div>

      {editingMap.sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="map-editor__section">
          <h4>{section.heading}</h4>
          {section.provisions.length === 0 ? (
            <p className="muted">No provisions in this section.</p>
          ) : (
            <ul className="map-editor__list">
              {section.provisions.map((provision, provisionIndex) => (
                <li key={`${provision.instrumentSlug}:${provision.segmentId}`} className="map-editor__item">
                  <span>{provision.segmentId}</span>
                  <div className="map-editor__item-actions">
                    <button
                      aria-label="Move up"
                      disabled={provisionIndex === 0}
                      onClick={() => moveProvision(sectionIndex, provisionIndex, provisionIndex - 1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label="Move down"
                      disabled={provisionIndex === section.provisions.length - 1}
                      onClick={() => moveProvision(sectionIndex, provisionIndex, provisionIndex + 1)}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      aria-label="Remove"
                      onClick={() => removeProvision(sectionIndex, provisionIndex)}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
