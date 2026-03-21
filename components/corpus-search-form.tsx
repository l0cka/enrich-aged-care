import clsx from "clsx";

import type { InstrumentManifestEntry } from "@/lib/types";

type SearchFacets = {
  categories?: string[];
  citations?: string[];
  instruments?: InstrumentManifestEntry[];
  terms?: string[];
  themes?: string[];
  types?: string[];
};

type SearchFormProps = {
  action: string;
  category?: string;
  citation?: string;
  className?: string;
  facets?: SearchFacets;
  instrument?: string;
  query?: string;
  selectedThemes?: string[];
  showFilters?: boolean;
  submitLabel?: string;
  term?: string;
  type?: string;
};

export function CorpusSearchForm({
  action,
  category,
  citation,
  className,
  facets,
  instrument,
  query,
  selectedThemes,
  showFilters = false,
  submitLabel = "Search",
  term,
  type,
}: SearchFormProps) {
  return (
    <form action={action} className={clsx("search-form", className)}>
      <label className="search-form__query">
        <span className="sr-only">Search the legislation corpus</span>
        <input
          defaultValue={query}
          name="q"
          placeholder="Search a phrase, section number, or ask a question"
          type="search"
        />
      </label>

      {showFilters && facets ? (
        <div className="search-form__filters">
          {facets.themes?.length ? (
            <fieldset className="search-form__themes">
              <legend>Themes</legend>
              <div className="chip-row chip-row--wrap">
                {facets.themes.map((theme) => (
                  <label key={theme} className={clsx("chip chip--toggle", selectedThemes?.includes(theme) && "chip--active")}>
                    <input
                      type="checkbox"
                      name="themes"
                      value={theme}
                      defaultChecked={selectedThemes?.includes(theme)}
                      className="sr-only"
                    />
                    {theme}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label>
            <span>Instrument</span>
            <select defaultValue={instrument ?? ""} name="instrument">
              <option value="">All instruments</option>
              {facets.instruments?.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Segment type</span>
            <select defaultValue={type ?? ""} name="type">
              <option value="">All types</option>
              {facets.types?.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select defaultValue={category ?? ""} name="category">
              <option value="">All categories</option>
              {facets.categories?.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Defined term</span>
            <select defaultValue={term ?? ""} name="term">
              <option value="">All terms</option>
              {facets.terms?.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Cited document</span>
            <select defaultValue={citation ?? ""} name="citation">
              <option value="">All cited documents</option>
              {facets.citations?.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <button className="button button--primary" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
