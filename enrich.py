"""
Enrich aged care legislation using Isaacus Kanon 2 Enricher.

Usage:
    pip install isaacus python-docx
    export ISAACUS_API_KEY="iuak_v1_uCVe5DXcEe_fyUx0XObJNNqm1djM2nGvhpd6hamALyt_268b119e"
    python enrich.py
"""

import json
import time
from pathlib import Path

from isaacus import Isaacus

DOCS = {
    "act": "act.txt",
    "rules": "rules.txt",
    "transitional": "transitional.txt",
}

def main():
    client = Isaacus()
    base = Path(__file__).parent

    for key, filename in DOCS.items():
        txt_path = base / filename
        out_path = base / f"{key}_enriched.json"

        if out_path.exists():
            print(f"Skipping {key} - {out_path.name} already exists")
            continue

        text = txt_path.read_text()
        print(f"Enriching {key} ({len(text):,} chars)...")

        start = time.time()
        response = client.enrichments.create(
            model="kanon-2-enricher",
            texts=text,
            overflow_strategy="chunk",
        )
        elapsed = time.time() - start

        results = [r.model_dump() for r in response.results]
        out_path.write_text(json.dumps(results, indent=2))

        print(f"  Done in {elapsed:.1f}s - {response.usage.input_tokens:,} tokens - saved {out_path.name}")

    print("\nAll done. Commit and push the *_enriched.json files.")

if __name__ == "__main__":
    main()
