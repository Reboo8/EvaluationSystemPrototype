# Workflow tests (headless Chrome, no extra dependencies)

```
npm run build && npx vite preview --port 4173 &
mkdir -p tools/shots
OUT=./tools/shots node tools/candidate-flow-test.mjs   # full candidate journey, screenshots in tools/shots/
OUT=./tools/shots node tools/flow-test.mjs             # link lifecycle: send → open → save & exit → resume → withdraw → expired → renew → careers apply → rescue
```

`cdp.mjs` is a tiny Chrome DevTools Protocol driver (launch with fake camera/mic/screen, goto, click by text, type into React inputs,
set file inputs, full-page screenshots including inner scroll panes, console/exception capture).

`candidate-flow-test.mjs` walks the rebuilt candidate flow end to end: Send Assessment → personal link → Instructions → Permission checks
(camera / mic / screen) → Identity (face capture + voice) → fullscreen gate → proctored modules in the configured order (coding with real
JS test execution, written with AI grading, typing with live WPM) → AI interview (typed fallback when speech is unavailable) → results →
Rank List. It prints the invite outcome (per-module bands, weighted score, status).

`module-gallery-test.mjs` — `OPP=2 OUT=./tools/shots node tools/module-gallery-test.mjs` walks one role and screenshots every module type
(OPP=1 Software Developer: coding/written/typing/interview · OPP=2 Customer Support: language sub-skills/typing/SJT/simulation/interview · OPP=3 Physician: MCQ/SJT/interview).

`ADDALL=1` makes the gallery add every catalog module in the builder first (the "all modules" stress case), e.g. `ADDALL=1 OPP=1 OUT=./tools/shots node tools/module-gallery-test.mjs`.
