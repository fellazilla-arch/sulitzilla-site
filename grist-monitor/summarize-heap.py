#!/usr/bin/env python3
import json
import sys
from collections import defaultdict
from os.path import basename


def summarize(path, top=25):
    print("loading", path, file=sys.stderr)
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
    by = defaultdict(lambda: {"count": 0, "self": 0})
    n = len(nodes) // stride
    total = 0
    for i in range(n):
        base = i * stride
        t = nodes[base + type_idx]
        tname = type_enum[t] if type_enum and t < len(type_enum) else str(t)
        name = strings[nodes[base + name_idx]]
        size = nodes[base + self_idx]
        total += size
        key = "%s:%s" % (tname, name)
        by[key]["count"] += 1
        by[key]["self"] += size
    print("=== %s nodes=%d selfMB=%.1f ===" % (basename(path), n, total / 1048576.0))
    print("%8s %8s name" % ("selfMB", "count"))
    rows = sorted(by.items(), key=lambda kv: kv[1]["self"], reverse=True)[:top]
    for k, v in rows:
        print("%8.1f %8d %s" % (v["self"] / 1048576.0, v["count"], k[:110]))
    print("")


if __name__ == "__main__":
    for path in sys.argv[1:]:
        summarize(path)
