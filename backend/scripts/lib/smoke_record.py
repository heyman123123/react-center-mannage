#!/usr/bin/env python3
"""Append one smoke result row to a JSONL file."""
import json
import sys

id_, title, layer, status, detail, path = sys.argv[1:7]
with open(path, "a", encoding="utf-8") as f:
    f.write(
        json.dumps(
            {
                "id": id_,
                "title": title,
                "layer": layer,
                "status": status,
                "detail": detail,
            },
            ensure_ascii=False,
        )
        + "\n"
    )
