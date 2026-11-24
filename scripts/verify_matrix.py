#!/usr/bin/env python3
"""《大脑出厂设置测评》v1.5 50 题池正交性 Python 独立自检脚本
直接解析 site/js/questions.js，验证全部 4 条硬数学断言并输出 PASS/FAIL 与实际数值。
"""

import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_JS = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "js", "questions.js"))

# impl_plan_v2_50q.md §2.2 50 道题「选项 A 权重预览」权威锚点表
EXPECTED_OPT_A = {
    "C01": [4, 2, 1, -2],   "C02": [-2, 4, 2, 1],   "C03": [1, -2, 4, 2],   "C04": [2, 1, -2, 4],
    "C05": [4, 2, -2, 1],   "C06": [-2, 4, 1, 2],   "C07": [1, -2, 2, 4],   "C08": [2, 1, 4, -2],
    "C09": [4, 1, 2, -2],   "C10": [-2, 2, 4, 1],   "C11": [1, 4, -2, 2],   "C12": [2, -2, 1, 4],
    "C13": [4, 1, -2, 2],   "C14": [-2, 2, 1, 4],   "C15": [1, 4, 2, -2],   "C16": [2, -2, 4, 1],
    "C17": [4, -2, 2, 1],   "C18": [-2, 1, 4, 2],   "C19": [1, 2, -2, 4],   "C20": [2, 4, 1, -2],
    "C21": [4, -2, 1, 2],   "C22": [-2, 1, 2, 4],   "C23": [1, 2, 4, -2],   "C24": [2, 4, -2, 1],
    "P01": [8, 4, 1, -2],   "P02": [-4, 8, 2, 1],   "P03": [2, -4, 4, 2],   "P04": [4, 2, -2, 4],
    "P05": [8, 2, -4, 1],   "P06": [-4, 4, 2, 2],   "P07": [2, -2, 4, 4],   "P08": [4, 1, 8, -2],
    "P09": [8, 1, 2, -4],   "P10": [-4, 2, 4, 2],   "P11": [2, 4, -2, 4],   "P12": [4, -2, 1, 8],
    "P13": [4, 2, -4, 2],   "P14": [-2, 4, 2, 4],   "P15": [1, 8, 4, -2],   "P16": [2, -4, 8, 1],
    "P17": [4, -4, 2, 2],   "P18": [-2, 2, 4, 4],   "P19": [1, 4, -2, 8],   "P20": [2, 8, 1, -4],
    "P21": [4, -2, 2, 4],   "P22": [-2, 1, 4, 8],   "P23": [1, 2, 8, -4],   "P24": [2, 4, -4, 2],
    "S01": [0, 0, 0, 0],    "S02": [0, 0, 0, 0],
}

EXPECTED_BLOCK_DIAG = {
    0: [100, 100, 100, 100], 1: [100, 100, 100, 100], 2: [100, 100, 100, 100],
    3: [100, 100, 100, 100], 4: [100, 100, 100, 100], 5: [100, 100, 100, 100],
    6: [400, 400, 100, 100], 7: [400, 100, 400, 100], 8: [400, 100, 100, 400],
    9: [100, 400, 400, 100], 10: [100, 400, 100, 400], 11: [100, 100, 400, 400],
}


def parse_questions_js(path: str):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    src_clean = re.sub(r"/\*[\s\S]*?\*/", "", src)
    mk_pat = re.compile(
        r"mk\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(null|\d+)\s*,\s*(C|\[[^\]]+\])\s*,\s*"
        r"'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([\s\S]*?)\]\s*\)",
        re.MULTILINE,
    )
    opt_pat = re.compile(
        r"\[\s*'([^']+)'\s*,\s*\[([^\]]+)\](?:\s*,\s*'([^']+)')?\s*\]"
    )

    items = []
    for m in mk_pat.finditer(src_clean):
        qid, tier, pair_tag, blk_raw, sc_raw, scene_tag, stem, opts_raw = m.groups()
        block_id = None if blk_raw == "null" else int(blk_raw)
        scales = [1, 1, 1, 1] if sc_raw == "C" else [int(x.strip()) for x in sc_raw.strip("[]").split(",")]
        options = []
        for idx, om in enumerate(opt_pat.finditer(opts_raw)):
            otext, w_raw, mcode = om.groups()
            weights = [int(x.strip()) for x in w_raw.split(",")]
            options.append({"key": "ABCD"[idx], "text": otext, "weights": weights, "metaCode": mcode})
        items.append({
            "id": qid, "tier": tier, "pairTag": pair_tag, "blockId": block_id,
            "scales": scales, "sceneTag": scene_tag, "stem": stem, "options": options,
        })
    return items


def gram_matrix(rows):
    return [[sum(r[i] * r[j] for r in rows) for j in range(4)] for i in range(4)]


def main() -> int:
    items = parse_questions_js(QUESTIONS_JS)
    print(f"Parsed {len(items)} questions from {QUESTIONS_JS}")
    all_pass = True

    if len(items) != 50 or any(len(q["options"]) != 4 for q in items):
        print(f"[FAIL] Question/option count invalid: {len(items)} questions")
        return 1

    orth_items = [q for q in items if q["tier"] != "special"]
    special_items = [q for q in items if q["tier"] == "special"]

    # ① 48 题分 12 块每块格拉姆矩阵正确 + 全局 W50^T W50 = 2100 I_4
    block_ok = 0
    block_details = []
    for b in range(12):
        b_items = [q for q in orth_items if q["blockId"] == b]
        rows = [opt["weights"] for q in b_items for opt in q["options"]]
        G = gram_matrix(rows)
        diag = [G[d][d] for d in range(4)]
        off_max = max(abs(G[i][j]) for i in range(4) for j in range(4) if i != j)
        ok = (len(b_items) == 4 and diag == EXPECTED_BLOCK_DIAG[b] and off_max == 0)
        if ok:
            block_ok += 1
        block_details.append((b, len(b_items), diag, off_max, ok))

    all_rows_50 = [opt["weights"] for q in items for opt in q["options"]]
    G_50 = gram_matrix(all_rows_50)
    g50_diag = [G_50[d][d] for d in range(4)]
    g50_off_max = max(abs(G_50[i][j]) for i in range(4) for j in range(4) if i != j)
    col_sums = [sum(r[d] for r in all_rows_50) for d in range(4)]
    scale_sums = [sum(q["scales"][d] for q in items) for d in range(4)]

    c1_pass = (block_ok == 12 and g50_diag == [2100, 2100, 2100, 2100] and g50_off_max == 0)
    all_pass = all_pass and c1_pass
    print(f"[{'PASS' if c1_pass else 'FAIL'}] ① 12块格拉姆矩阵校验: {block_ok}/12 块通过 | 全局 W50^T W50 对角={g50_diag}, 异维最大={g50_off_max} | 列和={col_sums} | 缩放和={scale_sums}")
    for b, cnt, diag, off_m, ok in block_details:
        print(f"       Block {b:02d} (n={cnt}): diag={diag}, off_diag_max={off_m} -> {'OK' if ok else 'BAD'}")

    # ② 异维内积全 0（48 题 × 6 异维对 = 288 组）
    zero_pairs = 0
    total_pairs = 0
    bad_diag = 0
    for q in orth_items:
        rows = [opt["weights"] for opt in q["options"]]
        G = gram_matrix(rows)
        if [G[d][d] for d in range(4)] != [25 * s * s for s in q["scales"]]:
            bad_diag += 1
        for i in range(4):
            for j in range(i + 1, 4):
                total_pairs += 1
                if G[i][j] == 0:
                    zero_pairs += 1

    c2_pass = (zero_pairs == total_pairs == 288 and bad_diag == 0)
    all_pass = all_pass and c2_pass
    print(f"[{'PASS' if c2_pass else 'FAIL'}] ② 异维内积全 0 校验: {zero_pairs}/{total_pairs} 组异维内积严格为 0 | 单题对角异常={bad_diag}")

    # ③ 48 个单题矩阵互异（且 24 道 Tier A 遍历 S4 全互异）
    orth_mats = [tuple(tuple(opt["weights"]) for opt in q["options"]) for q in orth_items]
    core_mats = [tuple(tuple(opt["weights"]) for opt in q["options"]) for q in orth_items if q["tier"] == "core"]
    u_orth, u_core = len(set(orth_mats)), len(set(core_mats))
    c3_pass = (u_orth == 48 and u_core == 24)
    all_pass = all_pass and c3_pass
    print(f"[{'PASS' if c3_pass else 'FAIL'}] ③ 单题矩阵互异校验: 48正交题互异={u_orth}/48 | Tier A S4互异={u_core}/24")

    # ④ 选项 A 权重与 §2.2 总表逐题一致 + 特种题零污染
    opt_a_match = 0
    mismatches = []
    for q in items:
        got_a = q["options"][0]["weights"]
        exp_a = EXPECTED_OPT_A.get(q["id"])
        if got_a == exp_a:
            opt_a_match += 1
        else:
            mismatches.append((q["id"], got_a, exp_a))

    special_ok = (
        len(special_items) == 2
        and all(q["scales"] == [0, 0, 0, 0] for q in special_items)
        and all(opt["weights"] == [0, 0, 0, 0] for q in special_items for opt in q["options"])
        and all({opt["metaCode"] for opt in q["options"]} == {"REBEL", "LEVER", "SHIELD", "SHADOW"} for q in special_items)
    )
    c4_pass = (opt_a_match == 50 and not mismatches and special_ok)
    all_pass = all_pass and c4_pass
    print(f"[{'PASS' if c4_pass else 'FAIL'}] ④ 选项 A 权重与 §2.2 总表逐题一致: {opt_a_match}/50 一致 | 特种题零污染与4副章覆盖={'OK' if special_ok else 'BAD'}")
    if mismatches:
        print("       Mismatches:", json.dumps(mismatches))

    print("-" * 72)
    print(f"OVERALL MATRIX VERIFICATION: {'PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
