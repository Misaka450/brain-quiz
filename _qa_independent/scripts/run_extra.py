#!/usr/bin/env python3
"""Extra probes: ?code= reload quota burn; small-target / overflow on quiz with long options; stage-3 label."""
import json, pathlib
from playwright.sync_api import sync_playwright
EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell"
BASE = "http://127.0.0.1:8099/"
out = {}
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    seen = []
    for k in range(6):
        page.goto(BASE + "?code=DM-KQX2-F2PY"); page.wait_for_timeout(500)
        seen.append({"load": k + 1,
                     "usage": json.loads(page.evaluate("localStorage.getItem('mxge_code_usage_v1')") or "{}").get("DM-KQX2-F2PY", {}).get("usedCount"),
                     "banner": page.evaluate("()=>{const b=document.getElementById('cover-unlock-banner');return b.hidden?null:b.textContent}")})
    out["url_code_reload_burn"] = seen
    page.screenshot(path=str(pathlib.Path(__file__).resolve().parents[1] / "16_code_burned_by_reloads.png"))
    br.close()
print(json.dumps(out, ensure_ascii=False, indent=1))
