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

        await page.click("#btn-start-quiz", timeout=10000)
        await page.wait_for_timeout(600)

        answered = 0
        gate_shot = False
        for step in range(120):
            # 结果页是否出现
            if await page.locator("#btn-open-poster").is_visible():
                print("RESULT reached, clicks =", answered)
                break

            # 门禁弹窗
            gate_open = await page.evaluate("() => {const m=document.getElementById('modal-gate');return !!(m && !m.hidden && m.getAttribute('aria-hidden')==='false');}")
            if gate_open:
                if not gate_shot:
                    await page.screenshot(path=f"{OUT}/h02_gate.png")
                    gate_shot = True
                    await page.fill("#modal-gate input[type='text']", CODE)
                    await page.click("#btn-unlock-submit", timeout=10000)
                    print("gate: code submitted")
                await page.wait_for_timeout(1500)
                continue

            # 选项
            cnt = await page.locator("#quiz-options .option-btn").count()
            if cnt == 0:
                await page.wait_for_timeout(300)
                continue
            clicked = False
            for k in range(cnt):
                loc = page.locator("#quiz-options .option-btn").nth(k)
                try:
                    if await loc.is_visible():
                        await loc.click(timeout=5000)
                        answered += 1
                        clicked = True
                        break
                except Exception:
                    continue
            await page.wait_for_timeout(380)
            if not clicked:
                await page.wait_for_timeout(300)

        await page.wait_for_timeout(1200)
        await page.screenshot(path=f"{OUT}/h03_result.png", full_page=True)
        body = await page.inner_text("body")
        print("== clicks:", answered, " gate_shot:", gate_shot)
        print("== RESULT TEXT ==")
        print(body[:1400])

        # 海报
        try:
            await page.click("#btn-open-poster", timeout=10000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"{OUT}/h04_poster.png", full_page=True)
            dims = await page.evaluate("() => Array.from(document.querySelectorAll('#modal-poster img, canvas')).map(e=>({tag:e.tagName,w:e.width,h:e.height,(e.src||'').length}))")
            print("POSTER ELEMENTS:", dims[:6])
        except Exception as e:
            print("poster failed:", e)

        print("=== ERRORS ===", errs[:6] if errs else "none")
        await b.close()

asyncio.run(main())