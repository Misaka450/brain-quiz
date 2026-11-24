#!/usr/bin/env python3
"""Independent acceptance QA (Playwright). Does NOT modify business code."""
import json, os, random, re, sys, time, base64, pathlib
from playwright.sync_api import sync_playwright

EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell"
SITE = pathlib.Path(__file__).resolve().parents[2]
OUT = SITE / "_qa_independent"
BASE = os.environ.get("BASE", "http://127.0.0.1:8099/")
CODE = "DM-KQX2-F2PY"
LOG = {"errors": [], "steps": {}}

def rec(k, v):
    LOG["steps"][k] = v
    print(f"[{k}] {json.dumps(v, ensure_ascii=False)[:1500]}", flush=True)

def new_ctx(browser, tag):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                              has_touch=True, accept_downloads=True, locale="zh-CN")
    page = ctx.new_page()
    def on_console(m):
        if m.type in ("error",):
            LOG["errors"].append({"ctx": tag, "type": "console." + m.type, "text": m.text})
        if m.type == "warning":
            LOG["errors"].append({"ctx": tag, "type": "console.warning", "text": m.text})
    page.on("console", on_console)
    page.on("pageerror", lambda e: LOG["errors"].append({"ctx": tag, "type": "pageerror", "text": str(e)}))
    page.on("response", lambda r: r.status >= 400 and LOG["errors"].append({"ctx": tag, "type": f"http{r.status}", "text": r.url}))
    page.on("requestfailed", lambda r: LOG["errors"].append({"ctx": tag, "type": "requestfailed", "text": r.url + " " + str(r.failure)}))
    return ctx, page

def visible(page, sel):
    return page.evaluate("s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'}", sel)

def cur_qid(page):
    return page.evaluate("()=>{const b=document.querySelector('#quiz-options .option-btn');return b?b.dataset.qid:null}")

def answer_one(page, idx):
    """Click option idx on current question; wait for next state. Returns new state string."""
    old = cur_qid(page)
    page.click(f'#quiz-options .option-btn[data-idx="{idx}"]')
    page.wait_for_function(
        """old=>{const g=document.getElementById('modal-gate'),r=document.getElementById('view-result'),l=document.getElementById('view-loading');
        const b=document.querySelector('#quiz-options .option-btn');
        return (!g.hidden)||(!r.hidden)||(!l.hidden)||(b&&b.dataset.qid!==old)}""", arg=old, timeout=8000)
    if visible(page, "#modal-gate"): return "gate"
    if visible(page, "#view-loading") or visible(page, "#view-result"): return "done"
    return "next"

def run_to_end(page, picker, max_q=40, gate_code=CODE, shots=None):
    n = 0; seq = []
    while n < max_q:
        if visible(page, "#view-loading") or visible(page, "#view-result"): break
        qid = cur_qid(page)
        i = picker(n, qid)
        seq.append((qid, i))
        if shots and n in shots: shots[n]()
        st = answer_one(page, i); n += 1
        if st == "gate":
            if gate_code is None: return n, seq, "gate"
            page.fill("#input-code", gate_code); page.click("#btn-unlock-submit")
            page.wait_for_function("()=>document.getElementById('modal-gate').hidden", timeout=5000)
        if st == "done": break
    page.wait_for_selector("#view-result:not([hidden])", timeout=8000)
    return n, seq, "result"

def result_info(page):
    return page.evaluate("""()=>{const s=BrainLab.App.getState(),r=s.rep;return{
      asked:r.answeredCount, orth:r.orthCount, primary:r.primaryArchetype.id, primaryTitle:r.primaryArchetype.title,
      secondary:r.secondaryArchetype.id, meta:r.metaCode, ssr:r.isSsrVariant, badge:r.displayRarityBadge,
      scores:r.scoresDisplay, summary:document.getElementById('res-ask-summary').textContent,
      lastRun:(JSON.parse(localStorage.getItem('mxge_recent_runs_v15')||'{}').runs||[]).slice(-1)[0]||[] }}""")

def layout_audit(page, label):
    return page.evaluate("""label=>{
      const de=document.documentElement, vw=window.innerWidth;
      const out={label, scrollW:de.scrollWidth, clientW:de.clientWidth, hScroll:de.scrollWidth>de.clientWidth, overflowEls:[], smallTargets:[], clippedText:[]};
      const isVis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.closest('[hidden]')};
      document.querySelectorAll('body *').forEach(e=>{ if(!isVis(e))return; const r=e.getBoundingClientRect();
        if(r.right>vw+0.5||r.left<-0.5) out.overflowEls.push({tag:e.tagName,id:e.id,cls:e.className&&e.className.baseVal===undefined?e.className:'',l:Math.round(r.left),r:Math.round(r.right)});
        if(e.scrollWidth>e.clientWidth+1 && getComputedStyle(e).overflowX!=='visible' && e.clientWidth>0 && !['HTML','BODY'].includes(e.tagName)) out.clippedText.push({tag:e.tagName,id:e.id,cls:String(e.className),sw:e.scrollWidth,cw:e.clientWidth});
      });
      document.querySelectorAll('button,a,input,[role=button]').forEach(e=>{ if(!isVis(e))return; const r=e.getBoundingClientRect();
        if(r.height<48||r.width<48) out.smallTargets.push({tag:e.tagName,id:e.id,text:(e.textContent||e.value||'').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)});
      });
      out.overflowEls=out.overflowEls.slice(0,15); return out;}""", label)

def shot(page, name, full=False):
    p = OUT / name
    page.screenshot(path=str(p), full_page=full)
    return str(p)

PATTERNS = {
    "allA": lambda n, q: 0, "allB": lambda n, q: 1, "allC": lambda n, q: 2, "allD": lambda n, q: 3,
    "altAB": lambda n, q: n % 2, "altCD": lambda n, q: 2 + n % 2, "cycleABCD": lambda n, q: n % 4,
}
def rnd(seed):
    r = random.Random(seed); cache = {}
    def f(n, q):
        if n not in cache: cache[n] = r.randrange(4)
        return cache[n]
    return f

def main():
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
        audits = []

        # ---------- T1: main visual flow (gate path) ----------
        ctx, page = new_ctx(br, "T1-main")
        page.goto(BASE); page.wait_for_selector("#view-cover:not([hidden])")
        page.wait_for_timeout(300)
        shot(page, "01_cover.png"); shot(page, "01b_cover_full.png", full=True)
        audits.append(layout_audit(page, "cover"))
        page.click("#btn-start-quiz"); page.wait_for_selector("#view-quiz:not([hidden])")
        shot(page, "02_quiz_q1.png"); audits.append(layout_audit(page, "quiz-q1"))
        r1 = rnd(11)
        for k in range(4):
            st = answer_one(page, r1(k, None))
        rec("T1.gate_after_q4", {"gateVisible": visible(page, "#modal-gate"), "histLen": page.evaluate("BrainLab.App.getState().hist.length")})
        page.wait_for_timeout(400)
        shot(page, "03_gate.png"); audits.append(layout_audit(page, "gate"))
        rec("T1.gate_text", page.evaluate("()=>document.querySelector('.gsht').innerText"))
        # invalid codes
        inv = {}
        for c in ["DM-XXXX-YYYY", "DM-KQX2-F2PA", "ZZ-KQX2-F2PY", "DM-KQX0-F2PY", "abc", ""]:
            page.fill("#input-code", c); page.click("#btn-unlock-submit"); page.wait_for_timeout(250)
            inv[c or "<empty>"] = {"err": page.evaluate("()=>{const e=document.getElementById('gate-error');return e.hidden?null:e.textContent}"),
                                   "gateStillOpen": visible(page, "#modal-gate")}
            if c == "DM-XXXX-YYYY": shot(page, "04_gate_invalid.png")
        rec("B1.invalid_codes", inv)
        page.fill("#input-code", "dm kqx2 f2py")  # lowercase/space normalization + valid
        page.click("#btn-unlock-submit"); page.wait_for_timeout(500)
        rec("B1.valid_code", {"gateClosed": not visible(page, "#modal-gate"), "caseTag": page.text_content("#quiz-seq-tag"),
                              "code": page.evaluate("BrainLab.App.getState().code")})
        n, seq, _ = run_to_end(page, lambda n, q: r1(n + 4, q), gate_code=None,
                               shots={5: lambda: shot(page, "05_quiz_stage2.png")} )
        page.wait_for_timeout(500)
        info1 = result_info(page); rec("T1.result", info1)
        shot(page, "06_result_viewport.png"); shot(page, "07_result_full.png", full=True)
        audits.append(layout_audit(page, "result"))
        # radar svg label bbox check
        rec("A3.radar_labels", page.evaluate("""()=>{const svg=document.querySelector('#res-radar-wrap svg');const vb=svg.viewBox.baseVal;
           return [...svg.querySelectorAll('text')].map(t=>{const b=t.getBBox();return{t:t.textContent,x0:+b.x.toFixed(1),x1:+(b.x+b.width).toFixed(1),y0:+b.y.toFixed(1),y1:+(b.y+b.height).toFixed(1),inside:b.x>=0&&b.x+b.width<=vb.width&&b.y>=0&&b.y+b.height<=vb.height}})}"""))
        # poster
        page.click("#btn-open-poster")
        page.wait_for_function("()=>document.getElementById('poster-preview-img').src.startsWith('data:image/png')", timeout=8000)
        page.wait_for_timeout(500)
        shot(page, "08_poster_modal.png"); audits.append(layout_audit(page, "poster-modal"))
        durl = page.evaluate("document.getElementById('poster-preview-img').src")
        (OUT / "09_poster_raw.png").write_bytes(base64.b64decode(durl.split(",", 1)[1]))
        rec("A4.poster", page.evaluate("""()=>{const i=document.getElementById('poster-preview-img');const r=i.getBoundingClientRect();
            return{natural:[i.naturalWidth,i.naturalHeight],ratio:+(i.naturalWidth/i.naturalHeight).toFixed(4),shown:[Math.round(r.width),Math.round(r.height)],downloadBtnHidden:document.getElementById('btn-download-poster').hidden}}"""))
        page.click("#btn-close-poster"); page.wait_for_timeout(200)
        # export events
        with page.expect_download(timeout=5000) as dl:
            page.click('[data-action="export-events"]')
        d = dl.value; dp = OUT / "events_export.json"; d.save_as(str(dp))
        ev = json.loads(dp.read_text(encoding="utf-8"))
        names = [e["event"] for e in ev["events"]]
        qc = [e for e in ev["events"] if e["event"] == "quiz_complete"]
        rec("B6.export", {"file": d.suggested_filename, "count": ev["count"], "eventSeq": names,
                          "quiz_complete_props": qc[-1]["props"] if qc else None,
                          "gate_props": next((e["props"] for e in ev["events"] if e["event"] == "preview_gate_reached"), None),
                          "fail_reasons": [e["props"].get("reason") for e in ev["events"] if e["event"] == "code_unlock_fail"]})
        # retest x2
        ids_runs = [info1["lastRun"]]
        for k in range(2):
            page.click("#btn-retest"); page.wait_for_selector("#view-quiz:not([hidden])")
            run_to_end(page, rnd(100 + k), gate_code=None)
            page.wait_for_timeout(300)
            ids_runs.append(result_info(page)["lastRun"])
        def ov(a, b):
            sa, sb = set(a), set(b); return {"n1": len(a), "n2": len(b), "common": sorted(sa & sb), "symOverlap%": round(100 * len(sa & sb) / (0.5 * (len(a) + len(b))), 2)}
        core = lambda ids: [i for i in ids if i.startswith("C")]
        rec("B5.retest_overlap", {"run1": ids_runs[0], "run2": ids_runs[1], "run3": ids_runs[2],
                                  "r1_vs_r2": ov(ids_runs[0], ids_runs[1]), "r2_vs_r3": ov(ids_runs[1], ids_runs[2]),
                                  "r1_vs_r3": ov(ids_runs[0], ids_runs[2]),
                                  "stage1_core_overlap_r1r2r3": sorted(set(core(ids_runs[0])) & set(core(ids_runs[1])) | set(core(ids_runs[1])) & set(core(ids_runs[2])) | set(core(ids_runs[0])) & set(core(ids_runs[2]))),
                                  "special": [[i for i in r if i.startswith("S")] for r in ids_runs],
                                  "codeUsage": page.evaluate("localStorage.getItem('mxge_code_usage_v1')")})
        ctx.close()

        # ---------- T2: 10 answer sequences, answered count ----------
        runs = []
        plan = [("allA", PATTERNS["allA"], "url"), ("allB", PATTERNS["allB"], "gate"), ("allC", PATTERNS["allC"], "url"),
                ("allD", PATTERNS["allD"], "gate"), ("altAB", PATTERNS["altAB"], "url"), ("altCD", PATTERNS["altCD"], "gate"),
                ("cycleABCD", PATTERNS["cycleABCD"], "url"), ("rand7", rnd(7), "gate"), ("rand42", rnd(42), "url"), ("rand2026", rnd(2026), "gate")]
        for name, fn, mode in plan:
            ctx, page = new_ctx(br, "T2-" + name)
            page.goto(BASE + (f"?code={CODE}" if mode == "url" else ""))
            page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
            page.wait_for_selector("#view-quiz:not([hidden])")
            clicks, seq, _ = run_to_end(page, fn)
            page.wait_for_timeout(200)
            info = result_info(page)
            runs.append({"pattern": name, "mode": mode, "clicks": clicks, "asked": info["asked"], "orth": info["orth"],
                         "inRange": 16 <= info["asked"] <= 20 and clicks == info["asked"], "lastIsSpecial": seq[-1][0].startswith("S"),
                         "primary": info["primary"] + " " + info["primaryTitle"], "badge": info["badge"], "meta": info["meta"], "scores": info["scores"]})
            if name == "allA": shot(page, "10_result_allA.png")
            ctx.close()
        rec("B2.ten_runs", runs)

        # ---------- T3: determinism ----------
        det = []
        for k in range(2):
            ctx, page = new_ctx(br, f"T3-det{k}")
            page.goto(BASE + f"?code={CODE}"); page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
            page.wait_for_selector("#view-quiz:not([hidden])")
            _, seq, _ = run_to_end(page, rnd(555))
            info = result_info(page); det.append({"seq": seq, "primary": info["primary"], "scores": info["scores"], "meta": info["meta"]}); ctx.close()
        anon = []
        for k in range(2):
            ctx, page = new_ctx(br, f"T3-anon{k}")
            page.goto(BASE); page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
            page.wait_for_selector("#view-quiz:not([hidden])")
            _, seq, _ = run_to_end(page, rnd(555))
            info = result_info(page); anon.append({"qids": [s[0] for s in seq], "primary": info["primary"]}); ctx.close()
        rec("B3.determinism", {"sameQuestionSeq": det[0]["seq"] == det[1]["seq"], "primary": [d["primary"] for d in det],
                               "scores": [d["scores"] for d in det], "identical": det[0]["primary"] == det[1]["primary"] and det[0]["scores"] == det[1]["scores"],
                               "anonGateMode_sameLetters_primary": [a["primary"] for a in anon],
                               "anonGateMode_sameQuestions": anon[0]["qids"] == anon[1]["qids"]})

        # ---------- T4: resume at Q8 ----------
        ctx, page = new_ctx(br, "T4-resume")
        page.goto(BASE); page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
        page.wait_for_selector("#view-quiz:not([hidden])")
        f = rnd(9)
        for k in range(7):
            st = answer_one(page, f(k, None))
            if st == "gate":
                page.fill("#input-code", CODE); page.click("#btn-unlock-submit")
                page.wait_for_function("()=>document.getElementById('modal-gate').hidden")
        before = {"case": page.text_content("#quiz-seq-tag"), "qid": cur_qid(page), "hist": page.evaluate("BrainLab.App.getState().hist.map(h=>h.qId)"),
                  "stem": page.text_content("#quiz-stem")}
        page.reload(); page.wait_for_selector("#view-quiz:not([hidden])", timeout=5000); page.wait_for_timeout(300)
        after = {"case": page.text_content("#quiz-seq-tag"), "qid": cur_qid(page), "hist": page.evaluate("BrainLab.App.getState().hist.map(h=>h.qId)"),
                 "stem": page.text_content("#quiz-stem"), "toast": page.evaluate("()=>{const t=document.getElementById('stage-toast');return t.hidden?null:t.textContent}"),
                 "codeKept": page.evaluate("BrainLab.App.getState().code"), "gate": visible(page, "#modal-gate")}
        shot(page, "11_resume_after_reload.png")
        rec("B4.resume", {"before": before, "after": after, "restored": before["case"] == after["case"] and before["qid"] == after["qid"] and before["hist"] == after["hist"]})
        # prev-button + continue to finish
        n, seq, _ = run_to_end(page, rnd(10))
        rec("B4.resume_finish", result_info(page)); ctx.close()

        # resume at gate (4 answered, no code)
        ctx, page = new_ctx(br, "T4-resume-gate")
        page.goto(BASE); page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
        page.wait_for_selector("#view-quiz:not([hidden])")
        for k in range(4): answer_one(page, k % 4)
        page.reload(); page.wait_for_timeout(800)
        rec("B4.resume_at_gate", {"gateAfterReload": visible(page, "#modal-gate"), "hist": page.evaluate("BrainLab.App.getState().hist.length")})
        ctx.close()

        # ---------- T8: gate bypass probes ----------
        ctx, page = new_ctx(br, "T8-bypass")
        page.goto(BASE); page.wait_for_selector("#view-cover:not([hidden])"); page.click("#btn-start-quiz")
        page.wait_for_selector("#view-quiz:not([hidden])")
        for k in range(4): answer_one(page, 1)
        page.keyboard.press("Escape"); page.wait_for_timeout(200)
        esc_closes = not visible(page, "#modal-gate")
        # keyboard Tab out of modal to the underlying option buttons
        focused = []
        for k in range(12):
            page.keyboard.press("Tab")
            a = page.evaluate("()=>{const e=document.activeElement;return e?(e.id||e.className||e.tagName):null}")
            focused.append(a)
            if a and "option-btn" in a: break
        reached = bool(focused and "option-btn" in (focused[-1] or ""))
        bypass = {"escClosesGate": esc_closes, "tabSequence": focused, "underlyingOptionFocusable": reached}
        if reached:
            page.keyboard.press("Enter"); page.wait_for_timeout(500)
            bypass["histAfterEnter"] = page.evaluate("BrainLab.App.getState().hist.length")
            page.click("#btn-gate-back"); page.wait_for_timeout(500)
            bypass["afterBack"] = {"gate": visible(page, "#modal-gate"), "case": page.text_content("#quiz-seq-tag"),
                                   "hist": page.evaluate("BrainLab.App.getState().hist.length"), "code": page.evaluate("BrainLab.App.getState().code")}
            shot(page, "12_gate_bypass_q5_no_code.png")
            try:
                n, seq, status = run_to_end(page, rnd(3), gate_code=None)
                bypass["finishedWithoutCode"] = status == "result"
                bypass["result"] = result_info(page)
                shot(page, "13_gate_bypass_result.png")
            except Exception as e:
                bypass["finishErr"] = str(e)[:300]
        rec("B1.gate_bypass", bypass); ctx.close()

        # ---------- claim.html ----------
        ctx, page = new_ctx(br, "T-claim")
        page.goto(BASE + "claim.html"); page.wait_for_timeout(300); shot(page, "14_claim.png"); audits.append(layout_audit(page, "claim"))
        page.fill("#claim-input", "DM-XXXX-YYYY"); page.click("#claim-form button"); page.wait_for_timeout(200)
        cl_bad = page.text_content("#claim-status")
        page.fill("#claim-input", CODE); page.click("#claim-form button")
        page.wait_for_url(re.compile(r"index\.html\?code="), timeout=5000); page.wait_for_timeout(600)
        rec("claim", {"invalidMsg": cl_bad, "redirect": page.url, "banner": page.evaluate("()=>{const b=document.getElementById('cover-unlock-banner');return b.hidden?null:b.textContent}")})
        ctx.close()

        rec("A5.layout_audits", audits)
        br.close()

    rec("B7.errors", {"count": len(LOG["errors"]), "items": LOG["errors"][:50]})
    (OUT / "qa_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
