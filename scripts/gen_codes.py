#!/usr/bin/env python3
"""《大脑出厂设置测评》零依赖 HMAC-SHA256 卡密批量生成与对拍自检脚本
与 site/js/auth.js 字节级 100% 一致（FIPS 180-4 SHA-256 + RFC 2104 HMAC）。
"""

import argparse
import csv
import hashlib
import hmac
import os
import re
import secrets
import sys
from typing import List, Tuple

ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
VALID_PREFIXES = {"DM", "S1", "B3", "CP"}
DEFAULT_SECRET = "MXGE_BRAIN_V1_2026_SALT_9F3A"


def compute_tag4(secret: str, prefix: str, nonce4: str) -> str:
    msg = f"{prefix}:{nonce4}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()
    val20 = ((digest[0] << 12) | (digest[1] << 4) | (digest[2] >> 4)) & 0xFFFFF
    return "".join(ALPHABET[(val20 >> (15 - 5 * i)) & 0x1F] for i in range(4))


def verify_code(raw_input: str, secret: str = DEFAULT_SECRET) -> Tuple[bool, str, str]:
    clean = re.sub(r"[\s\-]+", "", (raw_input or "").strip().upper())
    if len(clean) != 10:
        return False, "FORMAT_ERROR", ""
    prefix, nonce, tag = clean[:2], clean[2:6], clean[6:10]
    if prefix not in VALID_PREFIXES:
        return False, "INVALID_PREFIX", ""
    if any(ch not in ALPHABET for ch in nonce + tag):
        return False, "INVALID_CHAR", ""
    expected = compute_tag4(secret, prefix, nonce)
    if hmac.compare_digest(tag, expected):
        return True, "OK", f"{prefix}-{nonce}-{tag}"
    return False, "BAD_MAC", f"{prefix}-{nonce}-{tag}"


def generate_batch(prefix: str, count: int, secret: str) -> List[str]:
    if prefix not in VALID_PREFIXES:
        raise ValueError(f"Invalid prefix '{prefix}', must be one of {sorted(VALID_PREFIXES)}")
    if not (1 <= count <= 100000):
        raise ValueError("count must be between 1 and 100000")
    seen_nonces = set()
    codes: List[str] = []
    while len(codes) < count:
        nonce = "".join(secrets.choice(ALPHABET) for _ in range(4))
        if nonce in seen_nonces:
            continue
        seen_nonces.add(nonce)
        tag = compute_tag4(secret, prefix, nonce)
        codes.append(f"{prefix}-{nonce}-{tag}")
    return codes


def run_self_test(secret: str = DEFAULT_SECRET) -> None:
    vectors = [
        ("DM-TEST-ZXZZ", True, "OK", "DM-TEST-ZXZZ"),
        ("s1 8k9p yknf", True, "OK", "S1-8K9P-YKNF"),
        ("B3-7H4N-PM4V", True, "OK", "B3-7H4N-PM4V"),
        ("CP-5X2L-RSGB", True, "OK", "CP-5X2L-RSGB"),
        ("S1-8K9P-AAAA", False, "BAD_MAC", "S1-8K9P-AAAA"),
        ("S1-8K90-YKNF", False, "INVALID_CHAR", ""),
    ]
    for raw, exp_valid, exp_reason, exp_fmt in vectors:
        ok, reason, fmt = verify_code(raw, secret)
        assert ok == exp_valid and reason == exp_reason and fmt == exp_fmt, (
            f"Vector mismatch for {raw!r}: got ({ok}, {reason}, {fmt!r}), "
            f"expected ({exp_valid}, {exp_reason}, {exp_fmt!r})"
        )
    print(f"SELF-TEST PASS: {len(vectors)}/{len(vectors)} benchmark vectors matched.")


def main() -> int:
    parser = argparse.ArgumentParser(description="生成《大脑出厂设置测评》HMAC-SHA256 专属卡密")
    parser.add_argument("--prefix", default="DM", choices=sorted(VALID_PREFIXES), help="SKU 归因前缀 (DM/S1/B3/CP)")
    parser.add_argument("--count", type=int, default=5, help="生成数量 (1~100000)")
    parser.add_argument("--secret", default=os.environ.get("MXGE_HMAC_SECRET", DEFAULT_SECRET), help="HMAC 盐值密钥")
    parser.add_argument("--out", default="", help="输出文件路径（支持 .txt 或 .csv；留空直接输出到标准输出）")
    parser.add_argument("--self-test", action="store_true", help="运行 impl_plan §4.5 六组基准向量自检")
    args = parser.parse_args()

    if args.self_test:
        run_self_test(DEFAULT_SECRET)
        return 0

    codes = generate_batch(args.prefix, args.count, args.secret)
    for code in codes:
        ok, reason, _ = verify_code(code, args.secret)
        assert ok and reason == "OK", f"Generated invalid code: {code}"

    if args.out:
        if args.out.lower().endswith(".csv"):
            with open(args.out, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["code", "prefix"])
                for c in codes:
                    writer.writerow([c, args.prefix])
        else:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write("\n".join(codes) + "\n")
        print(f"Generated {len(codes)} codes ({args.prefix}) -> {args.out}")
    else:
        for c in codes:
            print(c)
    return 0


if __name__ == "__main__":
    sys.exit(main())
