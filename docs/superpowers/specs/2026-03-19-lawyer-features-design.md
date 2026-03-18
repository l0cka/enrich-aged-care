# Lawyer-Indispensable Features — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Context

Enrich Aged Care is a legislation explorer for Australia's aged care law (3 instruments: Aged Care Act 2024, Aged Care Rules 2025, Transitional Rules 2025). The primary users are external legal service providers who draft decisions on behalf of government.

Their core pain points are **finding relevant provisions** across fragmented instruments and **tracing obligation chains** when one instrument delegates to another. The current tool has enriched reading, cross-references, and search — but lacks workflow features that connect research to decision-drafting.

These three features transform the tool from a reference reader into a decision-drafting workflow tool. They work as a system: **Maps → Pathways → Collect → Export**.

**Principles:** Structural/deterministic only (no AI). Build on existing cross-reference data. localStorage for persistence (no accounts). Trust through verifiability.

---

## Feature 1: Provision Pathways (Obligation Chain Tracer)

### Purpose

Given any provision, show the full chain of connected provisions across instruments. A lawyer looking at s 65 of the Act can see what it delegates to the Rules, what the Rules specify in return, and what other provisions reference the same chain.

### Data Model

```typescript
interface PathwayNode {
  segmentId: string;          // e.g. "seg:section-65"
  instrumentSlug: string;
  label: string;              // e.g. "s 65 Obligations of registered providers"
  code: string | null;        // null for container segments (chapters, parts)
  text: string;               // provision text (first ~200 chars for preview)
}

interface PathwayEdge {
  from: string;               // segmentId
  to: string;                 // segmentId
  relationship: PathwayRelationship;
}

// Derived from existing RelatedProvision.relationKind + instrument context
type PathwayRelationship =
  | 'delegates_to'      // this_provision_cites when source is statute, target is regulation
  | 'specified_by'      // cites_this_provision when source is statute, target is regulation
  | 'references'        // this_provision_cites (same instrument type, or regulation→statute)
  | 'referenced_by'     // cites_this_provision (same instrument type, or regulation→statute)
  | 'internal';         // via_internal_reference (same instrument)

interface Pathway {
  seed: PathwayNode;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  truncated: boolean;         // true if node cap was hit
  totalCount: number;         // total nodes before truncation
}
```

**Edge type mapping from existing data:**

| `RelatedProvision.relationKind` | Source instrument | Target instrument | `PathwayRelationship` |
|---|---|---|---|
| `this_provision_cites` | statute | regulation | `delegates_to` |
| `cites_this_provision` | statute | regulation | `specified_by` |
| `this_provision_cites` | regulation | statute | `references` |
| `cites_this_provision` | regulation | statute | `referenced_by` |
| `this_provision_cites` | same | same | `references` |
| `cites_this_provision` | same | same | `referenced_by` |
| `via_internal_reference` | any | same | `internal` |

### Computation

1. Start from a seed provision's segment ID
2. Look up the seed in the existing `relatedProvisions` index (from `lib/server/related-provisions.ts`)
3. For each related provision, classify the edge type using the mapping table above
4. Follow edges recursively up to **3 hops** from the seed
5. De-duplicate nodes; **cap at 50 nodes total**. If the graph exceeds this, truncate at the current depth and set `truncated: true`
6. Return the pathway

This is a server-side computation using existing data — no new ingestion needed. The `getRelatedProvisionIndex()` function already maps bidirectional relationships across instruments. The existing per-segment cap of 12 related provisions limits fan-out.

### UI

**Entry point:** A "Trace pathway" button on each provision in the reader view, positioned near the existing cross-reference chips in the margin rail.

**Pathway view:** A new route at `/pathway/[instrumentSlug]/[segmentAnchor]`. The route parameters identify the **seed provision only** — the pathway view renders nodes from all instruments. Resolve anchor to segment ID via the bundle's segment list: `bundle.segments.find(s => s.anchor === segmentAnchor)`.

**Layout:**
- **Top:** Seed provision displayed prominently with full text
- **Body:** Connected provisions in a vertical tree/list (not a force graph), grouped by instrument. Each node shows:
  - Instrument badge (colour-coded)
  - Provision label and code
  - Relationship type badge (e.g. "delegates to", "specified by")
  - First ~2 lines of provision text as preview
  - Click to expand full text inline, or navigate to reader
- **Right rail:** Clicking a pathway node sets it as the active provision. The right rail renders the same cross-reference chips, defined terms, and citations as the reader margin rail, reusing shared sub-components extracted from the reader's rail implementation.
- **Truncation indicator:** When `truncated` is true, show "Showing 50 of {totalCount} connected provisions" at the bottom of the list.

**Empty state:** When a provision has no connected provisions, display the seed provision with a message: "No cross-instrument connections found for this provision."

**Depth controls:** Toggle between 1-hop (direct connections only), 2-hop (default), and 3-hop views.

### Files to modify/create

- `lib/server/pathways.ts` — new: pathway computation from relatedProvisions index
- `lib/types.ts` — add PathwayNode, PathwayEdge, PathwayRelationship, Pathway types
- `app/pathway/[instrumentSlug]/[segmentAnchor]/page.tsx` — new: pathway view page
- `app/[slug]/page.tsx` — add "Trace pathway" button to margin rail
- `components/pathway-tree.tsx` — new: pathway tree/list rendering component
- `app/globals.css` — add pathway tree styles (node cards, edge badges, depth controls)

---

## Feature 2: Decision Pathway Maps (Topic-Based Navigation)

### Purpose

Pre-built collections of provisions grouped by decision topic. A lawyer drafting a provider registration decision opens the "Provider Registration" map and sees every relevant provision across all 3 instruments in logical order.

### Data Model

```typescript
interface MapProvision {
  instrumentSlug: string;
  segmentId: string;
  annotation?: string;        // why this provision matters in this context
}

interface MapSection {
  heading: string;            // e.g. "Eligibility Requirements"
  provisions: MapProvision[];
}

interface PathwayMap {
  id: string;                 // e.g. "provider-registration"
  title: string;
  description: string;
  builtIn: boolean;
  sections: MapSection[];
}
```

### Storage

**Built-in maps:** Static JSON files in a new `generated-data/maps/` directory, committed to the repo. Loaded server-side via `readFile` in a server component, following the same pattern as `lib/server/data.ts` reads from `generated-data/`.

**User maps:** Stored in `localStorage` under key `enrich:user-maps` with a schema version for migration:

```typescript
interface UserMapsStore {
  version: 1;
  maps: PathwayMap[];
}
```

The store wrapper in `lib/maps-store.ts` checks the version on load and handles migration or graceful reset if the schema changes.

Users can:
- Duplicate a built-in map to create a customisable copy
- Create a map from scratch
- Edit section headings, reorder provisions, add/remove provisions, add annotations

### Default Maps to Ship

| Map | Description | Key instruments |
|-----|-------------|-----------------|
| Provider Registration | Application, assessment, conditions, refusal | Act Ch 2 + Rules |
| Quality & Safety Standards | Obligations, compliance, monitoring | Act Ch 3 + Rules |
| Sanctions & Enforcement | Notices, sanctions, review rights | Act Ch 5 + Rules |
| Funding & Subsidies | Entitlements, claims, calculations | Act Ch 4 + Rules |
| Complaints & Reviews | Process, internal review, tribunal | Act Ch 6 + Rules |

These are hand-curated. Map content is authored by reading the Act's chapter structure and mapping the corresponding Rules provisions using existing cross-reference data.

### UI

**Navigation:** New "Maps" link in site header (alongside Corpus and Search).

**Maps index page (`/maps`):**
- Grid of map cards (built-in first, then user-created)
- Each card: title, description, provision count, instrument badges
- "Create new map" button

**Map detail page (`/maps/[id]`):**
- **Left column:** Ordered list of provisions grouped by section heading
  - Each provision shows: instrument badge, label, optional annotation
  - Click to select and show full text in right column
- **Right column:** Selected provision's full text + margin rail context (defined terms, cross-refs)
- **Top bar:**
  - "Edit" toggle (user maps only; built-in maps show "Duplicate to edit")
  - "Add all to collection" button (integration with Feature 3)
  - Provision count and instrument coverage summary

**Edit mode (user maps):**
- Reorder provisions within sections using up/down arrow buttons (no drag-and-drop library; keeps dependencies minimal)
- Add/remove provisions via search-and-add dialog
- Edit section headings and annotations inline
- Add/remove sections

**Reader integration:** When viewing a provision in the main reader, a subtle "In maps: Provider Registration, Quality Standards" indicator appears if the provision belongs to any maps. Clicking navigates to that map.

### Scope boundaries

- Collections are device-local only. URL-based sharing is a future enhancement.
- Built-in maps are hand-curated static JSON — no algorithmic generation in v1
- Maps reference provisions by segment ID — if the underlying data changes (new compilation), maps may need updating

### Files to modify/create

- `generated-data/maps/*.json` — new: built-in map definitions (one per map)
- `lib/types.ts` — add PathwayMap, MapSection, MapProvision, UserMapsStore types
- `lib/server/maps.ts` — new: load built-in maps from JSON via readFile
- `lib/maps-store.ts` — new: client-side localStorage wrapper for user maps (versioned schema)
- `app/maps/page.tsx` — new: maps index page
- `app/maps/[id]/page.tsx` — new: map detail page
- `components/map-card.tsx` — new: map card for index grid
- `components/map-provision-list.tsx` — new: provision list within map detail
- `components/map-editor.tsx` — new: edit mode controls (up/down reorder, add/remove)
- `app/[slug]/page.tsx` — add "In maps" indicator to provisions
- `app/layout.tsx` — add "Maps" to site header nav
- `app/globals.css` — add map grid, detail layout, and editor styles

---

## Feature 3: Citation Clipboard & Export

### Purpose

A persistent collection that accumulates provisions as a lawyer researches. Export as formatted text with precise citations, ready to paste into a decision document.

### Data Model

```typescript
interface CollectionItem {
  segmentId: string;
  instrumentSlug: string;
  note: string;               // user annotation
  addedAt: number;            // timestamp
}

interface CollectionStore {
  version: 1;
  items: CollectionItem[];
}
```

Note: `formalCitation` and `excerptText` are **not stored** in localStorage. They are resolved at render time from the server-side segment data using `segmentId` + `instrumentSlug`. This keeps localStorage lean and avoids stale text if data is recompiled.

### Citation Format Generation

Deterministic, built from existing segment and instrument metadata:

| Segment type | Prefix | Example |
|-------------|--------|---------|
| section | s | s 65(1) |
| subsection | s | s 65(1) (uses parent section number) |
| rule | r | r 42(2) |
| subrule | r | r 42(2) (uses parent rule number) |
| schedule | sch | sch 1 |
| clause | cl | cl 5 |
| part | pt | pt 3 |
| division | div | div 2 |
| chapter | ch | ch 4 |
| paragraph | para | para (a) |
| subparagraph | subpara | subpara (i) |

**Fallback:** For segment types not in this table, use the segment's `label` field directly (it already contains a human-readable label like "1 Short title").

**Full citation pattern:** `{prefix} {code} of the {instrument title}`
- `s 65(1) of the Aged Care Act 2024`
- `r 42(2) of the Aged Care Rules 2025`

Generated from:
- `segment.type` → prefix lookup (table above)
- `segment.code` → number/subsection (if null, use label)
- `instrument.title` from manifest → full name (italicised in export)

### Storage

`localStorage` under key `enrich:collection`, using the versioned `CollectionStore` schema. The store wrapper in `lib/collection-store.ts` checks the version on load and handles migration or graceful reset.

### UI

**Pin button:** A "+" icon on each provision in:
- Reader view (each segment in the main content area)
- Search results (each result card)
- Pathway view (each node)
- Map detail view (each provision)

When pinned, icon changes to a checkmark. Click again to unpin.

**Collection indicator:** A persistent "Collection (N)" button in the site header, visible whenever N > 0. Subtle badge showing count.

**Collection drawer:** Slides out from the right when the header button is clicked.
- Ordered list of collected provisions, each showing:
  - Formal citation (bold, resolved at render time)
  - First line of provision text (truncated, resolved at render time)
  - User note (editable inline, click to add)
  - Remove button
- Reorder via up/down arrow buttons (same pattern as map editor — no drag library)
- Click citation to navigate to provision in reader
- **Bottom actions:**
  - "Copy all" — formatted text with citations + full provision text
  - "Copy citations only" — just the citation list
  - "Clear all" — with confirmation dialog

**Clipboard error handling:** If `navigator.clipboard.writeText()` fails (permissions denied, insecure context), fall back to rendering the export text in a read-only `<textarea>` with a "Select all and copy" prompt. Show a toast on success or failure.

**Toast component:** A minimal auto-dismiss toast (3s, positioned bottom-center). Used for clipboard success/failure and bulk-add confirmations. Implemented as a simple React component in `components/toast.tsx` — no library dependency.

**Export format (Copy all):**
```
s 65(1) of the Aged Care Act 2024
"A registered provider must ensure that the aged care services and
supports it delivers to an individual comply with..."

r 42(2) of the Aged Care Rules 2025
"For the purposes of section 65(1) of the Act, the provider must..."
```

**Export format (Citations only):**
```
s 65(1) of the Aged Care Act 2024
r 42(2) of the Aged Care Rules 2025
```

### Integration with Features 1 & 2

- **From Provision Pathway view:** "Add chain to collection" button pins all provisions in the current pathway
- **From Decision Pathway Map:** "Add all to collection" button pins all provisions in the map
- Both bulk-add actions show a toast confirmation ("Added 8 provisions to collection")

### Scope boundaries

- Collections are device-local only. URL-based sharing is a future enhancement.
- Plain text export only in v1 (no .docx generation)
- Maximum ~50 items (practical limit for a single decision)

### Files to modify/create

- `lib/types.ts` — add CollectionItem, CollectionStore types
- `lib/citation.ts` — new: deterministic citation format generation with full type table and fallback
- `lib/collection-store.ts` — new: client-side localStorage wrapper with add/remove/reorder/export (versioned schema)
- `components/collection-drawer.tsx` — new: slide-out collection panel
- `components/pin-button.tsx` — new: reusable pin/unpin button
- `components/toast.tsx` — new: minimal auto-dismiss toast component
- `app/layout.tsx` — add collection indicator to header
- `app/[slug]/page.tsx` — add pin buttons to segments
- `app/search/page.tsx` — add pin buttons to search results
- `app/pathway/[instrumentSlug]/[segmentAnchor]/page.tsx` — add pin buttons + "Add chain" button
- `app/maps/[id]/page.tsx` — add pin buttons + "Add all" button
- `app/globals.css` — add drawer, pin button, and toast styles

---

## System Integration Summary

```
Decision Pathway Maps ─── "What provisions do I need?"
        │
        ▼
Provision Pathways ────── "What's the full obligation chain?"
        │
        ▼
Citation Clipboard ────── "Collect and export for my decision"
```

**Shared infrastructure:**
- All features build on existing `relatedProvisions` index and segment data
- Citation generation (`lib/citation.ts`) is shared between Features 1 and 3
- Pin button component is shared across all views
- localStorage patterns shared between Features 2 (user maps) and 3 (collection), both using versioned schemas
- Toast component shared across all features for action confirmations
- Up/down reorder pattern shared between map editor and collection drawer

## Accessibility

All new UI must meet the following baseline:
- **Keyboard navigation:** All interactive elements (buttons, nodes, drawer controls) reachable via Tab. Pathway nodes navigable with arrow keys.
- **Focus management:** Collection drawer traps focus when open; returns focus to trigger button on close.
- **Screen readers:** ARIA labels on instrument badges, relationship badges, pin buttons ("Pin section 65 to collection" / "Unpin section 65 from collection"). Drawer announced with `role="dialog"` and `aria-label`.
- **Colour contrast:** All badge text meets WCAG AA contrast ratio in both light and dark themes.

## Styling Approach

All new styles go in `app/globals.css`, following the project's existing pattern of vanilla CSS with CSS custom properties for theming. No CSS modules or component-scoped styles — match the existing convention. All new colour values must use existing CSS custom properties (or define new ones in the `:root` / `[data-theme="dark"]` blocks) to ensure dark mode compatibility.

## Build Order

1. **Feature 3: Citation Clipboard** — smallest scope, highest standalone value, establishes localStorage patterns, pin button, and toast component
2. **Feature 1: Provision Pathways** — builds on existing cross-ref data, introduces pathway computation used by Feature 2
3. **Feature 2: Decision Pathway Maps** — most ambitious, benefits from pathway computation and collection/pin infrastructure from Features 1 & 3

## Verification

For each feature:
1. **Manual testing:** Navigate the reader, use the feature, verify all UI states including empty states
2. **Cross-instrument:** Test with provisions that span Act → Rules and Rules → Act
3. **Export accuracy:** For Feature 3, verify citation format against Australian legislative citation conventions
4. **Clipboard fallback:** Test clipboard export in both secure and insecure contexts
5. **Persistence:** For Features 2 & 3, verify localStorage survives page reload; test with corrupted/outdated localStorage data to verify graceful migration
6. **Responsive:** Verify drawer/panel behaviour at mobile breakpoint (< 760px)
7. **Dark mode:** Verify all new UI respects existing light/dark theme variables
8. **Accessibility:** Verify keyboard navigation through pathway tree, collection drawer, and map editor; test with screen reader
9. **Truncation:** For Feature 1, verify pathway view handles large graphs (50+ nodes) gracefully with truncation indicator
