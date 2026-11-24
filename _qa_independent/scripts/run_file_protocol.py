#!/usr/bin/env python3
"""file:// double-click test (no server)."""
import json, pathlib, random, base64
from playwright.sync_api import sync_playwright
EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell"
SITE = pathlib.Path(__file__).resolve().parents[2]
OUT = SITE / "_qa_independent"
errs = []
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: m.type in ("error", "warning") and errs.append(("console." + m.type, m.text)))
    page.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errs.append(("requestfailed", r.url)))
    url = (SITE / "index.html").as_uri()
    page.goto(url); page.wait_for_selector("#view-cover:not([hidden])", timeout=5000)
    page.click("#btn-start-quiz"); page.wait_for_selector("#view-quiz:not([hidden])")
    r = random.Random(1); n = 0
    while n < 30:
        if not page.evaluate("document.getElementById('view-result').hidden&&document.getElementById('view-loading').hidden"): break
        old = page.evaluate("document.querySelector('#quiz-options .option-btn').dataset.qid")
        page.click(f'#quiz-options .option-btn[data-idx="{r.randrange(4)}"]'); n += 1
        page.wait_for_function("""o=>{const g=document.getElementById('modal-gate');const b=document.querySelector('#quiz-options .option-btn');
            return !g.hidden||!document.getElementById('view-loading').hidden||!document.getElementById('view-result').hidden||(b&&b.dataset.qid!==o)}""", arg=old)
        if page.evaluate("!document.getElementById('modal-gate').hidden"):
            page.fill("#input-code", "DM-KQX2-F2PY"); page.click("#btn-unlock-submit")
            page.wait_for_function("document.getElementById('modal-gate').hidden")
    page.wait_for_selector("#view-result:not([hidden])", timeout=8000)
    asked = page.evaluate("BrainLab.App.getState().rep.answeredCount")
    page.click("#btn-open-poster")
    page.wait_for_function("document.getElementById('poster-preview-img').src.startsWith('data:image/png')", timeout=8000)
    page.screenshot(path=str(OUT / "15_file_protocol_poster.png"))
    page.click("#btn-close-poster")
    with page.expect_download(timeout=5000) as dl:
        page.click('[data-action="export-events"]')
    ok_dl = bool(dl.value.suggested_filename)
    # file:// with ?code
    page2 = ctx.new_page(); page2.on("pageerror", lambda e: errs.append(("pageerror2", str(e))))
    page2.goto(url + "?code=DM-KQX2-F2PY"); page2.wait_for_timeout(800)
    banner = page2.evaluate("()=>{const b=document.getElementById('cover-unlock-banner');return b.hidden?null:b.textContent}")
    # claim.html under file://
    page3 = ctx.new_page(); page3.on("pageerror", lambda e: errs.append(("pageerror3", str(e))))
    page3.goto((SITE / "claim.html").as_uri()); page3.fill("#claim-input", "DM-KQX2-F2PY"); page3.click("#claim-form button")
    page3.wait_for_timeout(1200)
    print(json.dumps({"url": url, "asked": asked, "posterOk": True, "downloadOk": ok_dl, "urlCodeBanner": banner,
                      "claimRedirect": page3.url, "errors": errs}, ensure_ascii=False, indent=1))
    br.close()
