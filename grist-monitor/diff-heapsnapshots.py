#!/usr/bin/env python3
"""Compare two V8 .heapsnapshot files; print constructors that grew the most."""
import json
import sys
from collections import defaultdict

# Snapshot meta: nodes fields typically include type, name, id, self_size, edge_count, ...
# strings table is snapshot["snapshot"] + nodes/edges/strings

def load_counts(path):
    print(f"loading {path} ...", file=sys.stderr)
    with open(path) as f:
        data = json.load(f)
    meta = data["snapshot"]["meta"]
    node_fields = meta["node_fields"]
    node_types = meta["node_types"]
    strings = data["strings"]
    nodes = data["nodes"]
    stride = len(node_fields)
    type_idx = node_fields.index("type")
    name_idx = node_fields.index("name")
    self_idx = node_fields.index("self_size")
    type_enum = node_types[type_idx] if isinstance(node_types[type_idx], list) else None

    by_name = defaultdict(lambda: {"count": 0, "self": 0})
    n = len(nodes) // stride
    for i in range(n):
        base = i * stride
        t = nodes[base + type_idx]
        if type_enum:
            tname = type_enum[t] if t < len(type_enum) else str(t)
        else:
            tname = str(t)
        name = strings[nodes[base + name_idx]]
        size = nodes[base + self_idx]
        key = f"{tname}:{name}"
        by_name[key]["count"] += 1
        by_name[key]["self"] += size
    return by_name, n, sum(v["self"] for v in by_name.values())

def main():
    a_path, b_path = sys.argv[1], sys.argv[2]
    a, na, sa = load_counts(a_path)
    b, nb, sb = load_counts(b_path)
    print(f"nodes {na} -> {nb}  self_bytes {sa} -> {sb}  delta {sb-sa}")
    keys = set(a) | set(b)
    rows = []
    for k in keys:
        ca, sa_ = a.get(k, {"count": 0, "self": 0}).values() if False else (a.get(k, {"count": 0, "self": 0})["count"], a.get(k, {"count": 0, "self": 0})["self"])
        cb, sb_ = b.get(k, {"count": 0, "self": 0})["count"], b.get(k, {"count": 0, "self": 0})["self"]
        rows.append((sb_ - sa_, cb - ca, sb_, cb, k))
    rows.sort(reverse=True)
    print(f"{'dSelfMB':>10} {'dCount':>10} {'selfMB':>10} {'count':>10} name")
    for dself, dcount, selfb, count, k in rows[:40]:
        if dself <= 0 and dcount <= 0:
            continue
        print(f"{dself/1048576:10.2f} {dcount:10d} {selfb/1048576:10.2f} {count:10d} {k[:120]}")

if __name__ == "__main__":
    main()
