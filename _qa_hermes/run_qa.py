import asyncio
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8099/"
CODE = "DM-KQX2-F2PY"
OUT = "/root/outputs/x_mxge_test_product/site/_qa_hermes"
EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"], executable_path=EXE)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        page.on("console", lambda m: errs.append("CONSOLE_ERR: " + m.text) if m.type == "error" else None)

        await page.goto(URL, wait_until="networkidle")
        await page.screenshot(path=f"{OUT}/h01_cover.png")
        print("TITLE:", await page.title())

        # 点开始
        await page.locator("button").first.click()
        await page.wait_for_timeout(700)

        answered = 0
        gate_done = False
        result = False
        seq = [0, 1, 2, 3]

        for step in range(80):
            if await page.locator("#result-root:visible, #report-root:visible").count():
                result = True
                print("RESULT visible at click", answered)
                break

            gate_visible = await page.evaluate("""() => {
                const m = document.getElementById('modal-gate');
                return !!(m && m.getAttribute('aria-hidden') === 'false' && m.offsetParent !== null);
            }""")
            if gate_visible:
                if not gate_done:
                    await page.screenshot(path=f"{OUT}/h02_gate.png")
                    inp = page.locator("#modal-gate input[type='text'], #modal-gate input:not([type='hidden'])")
                    if await inp.count():
                        await inp.first.fill(CODE)
                    btns = page.locator("#modal-gate button")
                    for i in range(await btns.count()):
                        t = (await btns.nth(i).inner_text() or "").strip()
                        if any(k in t for k in ("解锁", "核销", "确认", "提交")):
                            await btns.nth(i).click()
                            print("unlock clicked:", t)
                            break
                await page.wait_for_timeout(1800)
                gate_done = True
                continue

            opts = page.locator("#quiz-options .option-btn")
            n = await opts.count()
            if n == 0:
                await page.wait_for_timeout(400)
                continue
            target = None
            for k in range(n):
                try:
                    if await opts.nth(k).is_visible():
                        target = opts.nth(k)
                        break
                except Exception:
                    pass
            if target is None:
                await page.wait_for_timeout(400)
                continue
            try:
                await target.click(timeout=5000)
            except Exception:
                await page.wait_for_timeout(500)
                continue
            answered += 1
            await page.wait_for_timeout(400)

        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/h03_result.png", full_page=True)
        body = await page.inner_text("body")
        print("== 实答点击数:", answered)
        print("== RESULT TEXT (1200) ==")
        print(body[:1200])
        print("== 含门禁截图:", gate_done, " 到达结果:", result)

        # 海报
        btns = page.locator("button")
        for i in range(await btns.count()):
            t = (await btns.nth(i).inner_text() or "").strip()
            if "海报" in t or "保存" in t or "分享" in t:
                await btns.nth(i).click()
                print("poster button:", t)
                break
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/h04_poster.png", full_page=True)
        dims = await page.evaluate("() => Array.from(document.querySelectorAll('img,canvas')).map(e=>({tag:e.tagName,w:e.width,h:e.height}))")
        print("IMG/CANVAS:", dims[:8])

        print("=== ERRORS ===", errs[:8] if errs else "none")
        await b.close()

asyncio.run(main())