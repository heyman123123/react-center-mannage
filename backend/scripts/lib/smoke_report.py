#!/usr/bin/env python3
"""根据用例文档 + 冒烟执行结果 JSONL，生成 Markdown 冒烟报告。"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

TC_ID_RE = re.compile(r"^TC-[A-Z0-9]+-\d+$")


def classify_auto(mark: str) -> str:
    text = mark.replace("\\", "").replace("*", "").strip()
    compact = text.replace(" ", "")
    if compact.startswith("N") or compact.startswith("**N"):
        return "MANUAL"
    if "冒烟-扩展" in text or compact.startswith("Y*"):
        return "EXTENDED"
    if compact.startswith("Y") or "Y（冒烟）" in text:
        return "CORE"
    if "合并执行" in text:
        return "CORE"
    return "MANUAL"


def parse_catalog(doc_path: Path) -> list[dict]:
    cases: list[dict] = []
    seen: set[str] = set()
    for raw in doc_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line.startswith("| TC-"):
            continue
        cols = [c.strip() for c in line.strip("|").split("|")]
        if len(cols) < 8:
            continue
        tc_id = cols[0]
        if not TC_ID_RE.match(tc_id) or tc_id in seen:
            continue
        seen.add(tc_id)
        cases.append(
            {
                "id": tc_id,
                "title": cols[1],
                "priority": cols[2],
                "type": cols[3],
                "automation": cols[7],
                "layer": classify_auto(cols[7]),
            }
        )
    return cases


def load_results(jsonl_path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not jsonl_path.exists():
        return out
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        out[row["id"]] = row
    return out


def badge(status: str) -> str:
    return {
        "PASS": "✅ PASS",
        "FAIL": "❌ FAIL",
        "WARN": "⚠️ WARN",
        "SKIP": "⏭ SKIP",
    }.get(status, status)


def render(meta: dict, catalog: list[dict], results: dict[str, dict]) -> str:
    now = meta.get("finishedAt") or dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    counts = Counter(r.get("status") for r in results.values())
    executed = len(results)
    fail_n = counts["FAIL"]
    pass_n = counts["PASS"]
    warn_n = counts["WARN"]
    skip_n = counts["SKIP"]
    verdict = "通过" if fail_n == 0 else "未通过"

    by_layer = defaultdict(list)
    for c in catalog:
        by_layer[c["layer"]].append(c)

    core_ids = {c["id"] for c in by_layer["CORE"]}
    ext_ids = {c["id"] for c in by_layer["EXTENDED"]}
    core_executed = [cid for cid in core_ids if cid in results]
    core_missing = sorted(core_ids - set(results))
    ext_executed = [cid for cid in ext_ids if cid in results]

    lines: list[str] = []
    a = lines.append
    a("# NovasPay 管理端 —— 冒烟测试报告")
    a("")
    a("| 项 | 值 |")
    a("|----|----|")
    a(f"| 结论 | **{verdict}** |")
    a(f"| 生成时间 | {now} |")
    a(f"| 目标环境 | `{meta.get('rootUrl', '')}` |")
    a(f"| 登录账号 | `{meta.get('adminEmail', '')}` |")
    a(f"| 执行层 | {meta.get('layers', 'CORE')} |")
    a(f"| 耗时 | {meta.get('elapsedSec', '-')} 秒 |")
    a(f"| 用例文档 | `{meta.get('catalogRel', 'docs/qa/NovasPay-测试用例文档.md')}` |")
    a(f"| 文档用例总数 | {len(catalog)} |")
    a("")
    a("## 1. 执行摘要")
    a("")
    a("| 结果 | 数量 |")
    a("|------|------|")
    a(f"| PASS | {pass_n} |")
    a(f"| FAIL | {fail_n} |")
    a(f"| WARN | {warn_n} |")
    a(f"| SKIP | {skip_n} |")
    a(f"| 本次实际执行 | {executed} |")
    a("")
    a("## 2. 与用例文档的覆盖对照")
    a("")
    a("| 自动化层 | 文档标记数 | 本次执行数 | 未执行 |")
    a("|----------|------------|------------|--------|")
    a(f"| CORE（Y 冒烟） | {len(core_ids)} | {len(core_executed)} | {len(core_missing)} |")
    a(f"| EXTENDED（Y* 扩展） | {len(ext_ids)} | {len(ext_executed)} | {len(ext_ids) - len(ext_executed)} |")
    a(f"| MANUAL（N 人工） | {len(by_layer['MANUAL'])} | 0（本脚本不执行） | {len(by_layer['MANUAL'])} |")
    a("")
    if core_missing:
        a("### 文档标记为 CORE 但本次未产出结果的用例")
        a("")
        for cid in core_missing:
            title = next((c["title"] for c in catalog if c["id"] == cid), "")
            a(f"- `{cid}` {title}")
        a("")
    if fail_n:
        a("## 3. 失败用例")
        a("")
        a("| 用例ID | 标题 | 详情 |")
        a("|--------|------|------|")
        for cid, row in results.items():
            if row.get("status") != "FAIL":
                continue
            a(f"| `{cid}` | {row.get('title', '')} | {escape_cell(row.get('detail', ''))} |")
        a("")
    a("## 4. 本次执行明细")
    a("")
    a("| 用例ID | 标题 | 优先级 | 层 | 结果 | 详情 |")
    a("|--------|------|--------|----|------|------|")
    catalog_index = {c["id"]: c for c in catalog}
    for cid, row in results.items():
        cat = catalog_index.get(cid, {})
        a(
            f"| `{cid}` | {row.get('title') or cat.get('title', '')} | "
            f"{cat.get('priority', '')} | {row.get('layer', cat.get('layer', ''))} | "
            f"{badge(row.get('status', ''))} | {escape_cell(row.get('detail', ''))} |"
        )
    a("")
    a("## 5. 文档中仍需人工回归的用例（N）")
    a("")
    a("以下用例未被本冒烟脚本执行，发布前请按 P0 → P1 → P2 顺序人工回归，尤其是状态机与权限矩阵。")
    a("")
    a("| 用例ID | 标题 | 优先级 | 类型 |")
    a("|--------|------|--------|------|")
    for c in catalog:
        if c["layer"] != "MANUAL":
            continue
        a(f"| `{c['id']}` | {c['title']} | {c['priority']} | {c['type']} |")
    a("")
    a("---")
    a("")
    a("本报告由 `backend/scripts/smoke_test.sh` 根据 `docs/qa/NovasPay-测试用例文档.md` 自动生成。")
    a("")
    return "\n".join(lines)


def escape_cell(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ").strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--results", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--meta", required=True, help="JSON 文件，含环境元数据")
    args = parser.parse_args()

    catalog = parse_catalog(Path(args.catalog))
    results = load_results(Path(args.results))
    meta = json.loads(Path(args.meta).read_text(encoding="utf-8"))
    report = render(meta, catalog, results)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(str(out))
    fail_n = sum(1 for r in results.values() if r.get("status") == "FAIL")
    return 1 if fail_n else 0


if __name__ == "__main__":
    raise SystemExit(main())
