// dsh-claude-artifacts 2.9.2: built from baoyu-design.
window.__ModuleLoader__.load({
	id: "dsh-claude-artifacts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		var client_exports = {};
		__export(client_exports, {
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(client_exports);
		var import_react3 = require("react");

		var import_react2 = require("react");

		function isNewer(a, b) {
		  const parts = (version) => {
		    const [core = "", pre] = version.split("+")[0].split(/-(.*)/s);
		    return { numbers: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
		  };
		  const left = parts(a);
		  const right = parts(b);
		  for (let i = 0; i < 3; i++) {
		    const difference = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0);
		    if (difference !== 0) return difference > 0;
		  }
		  if (left.pre === void 0 || right.pre === void 0) return left.pre === void 0 && right.pre !== void 0;
		  return left.pre.localeCompare(right.pre, "en", { numeric: true }) > 0;
		}
		var base = "/api/baoyu-design.artifacts";
		var listPath = base;
		var openPath = `${base}.open`;
		var previewPath = `${base}.preview`;
		var releasePath = `${base}.release`;
		var thumbnailPath = `${base}.thumbnail`;
		var updatePath = `${base}.update`;
		var deletePath = `${base}.delete`;
		var restorePath = `${base}.restore`;
		var updatesPath = `${base}.updates`;

		function desktopBrowser() {
		  const carrier = globalThis.dshDesktop;
		  return carrier?.protocolVersion === 1 ? carrier.browser : void 0;
		}
		var WORKSPACE = "baoyu-design-thumbnails";
		var WIDTH = 720;
		var QUALITY = 0.82;
		var LOAD_MS = 2e4;
		var SETTLE_MS = 1800;
		var BLANK_RETRY_MS = 3e3;
		var REGIONS = {
		  // The current slide on the editor's canvas.
		  "claude-slides": { width: 1280, height: 800, find: `document.querySelector('.bg-editor-canvas > .shadow-lg')` },
		  // The first artboard.
		  "claude-design": { width: 1280, height: 800, find: `document.querySelector('[data-mega-artboard]')` },
		  // What is beside the section list: the system's cover.
		  "claude-design-system": {
		    width: 1280,
		    height: 800,
		    find: `(() => {
		      const nav = document.querySelector('[data-testid="ds-section-nav"]');
		      if (!nav || !document.querySelector('h1,h2')) return null;
		      const r = nav.getBoundingClientRect();
		      return { x: r.right, y: r.top, width: innerWidth - r.right, height: innerHeight - r.top };
		    })()`
		  },
		  // The page, below the bar.
		  "claude-dashboard": { width: 1280, height: 800, find: `document.querySelector('main')` },
		  // The doc's frame, below the bars, at a width where the text fills it.
		  "claude-docs": { width: 860, height: 700, find: `document.querySelector('iframe')` },
		  // The film's first frame.
		  "claude-motion": { width: 1280, height: 800, find: `document.querySelector('.an-stage iframe')` }
		};
		var sleep = (ms, signal) => new Promise((resolve, reject) => {
		  if (signal.aborted) return reject(signal.reason);
		  const timer = setTimeout(resolve, ms);
		  signal.addEventListener("abort", () => {
		    clearTimeout(timer);
		    reject(signal.reason);
		  }, { once: true });
		});
		async function toCanvas(image) {
		  const picture = new Image();
		  await new Promise((resolve, reject) => {
		    picture.onload = () => resolve();
		    picture.onerror = () => reject(new Error("the picture did not decode"));
		    picture.src = image.toDataURL();
		  });
		  const scale = Math.min(1, WIDTH / picture.naturalWidth);
		  const canvas = document.createElement("canvas");
		  canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
		  canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
		  const context = canvas.getContext("2d");
		  if (context === null) throw new Error("no canvas to draw on");
		  context.imageSmoothingQuality = "high";
		  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
		  return canvas;
		}
		function isFlat(canvas) {
		  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
		  const step = Math.max(4, Math.floor(data.length / 4 / 400) * 4);
		  for (let i = step; i + 2 < data.length; i += step) {
		    if (Math.abs(data[i] - data[0]) > 3 || Math.abs(data[i + 1] - data[1]) > 3 || Math.abs(data[i + 2] - data[2]) > 3) return false;
		  }
		  return true;
		}
		async function captureThumbnail(browser, url, skill, signal) {
		  const region = REGIONS[skill] ?? { width: 1280, height: 800, find: "null" };
		  const { lease, partition } = await browser.acquire(WORKSPACE);
		  const guest = document.createElement("webview");
		  try {
		    guest.setAttribute("name", lease);
		    guest.setAttribute("partition", partition);
		    guest.setAttribute("src", `about:blank#${lease}`);
		    guest.setAttribute("aria-hidden", "true");
		    guest.tabIndex = -1;
		    guest.style.cssText = `position:fixed;left:calc(100vw - 1px);top:0;width:${region.width}px;height:${region.height}px;opacity:.01;pointer-events:none;z-index:-1`;
		    const ready = new Promise((resolve) => guest.addEventListener("dom-ready", () => resolve(), { once: true }));
		    document.body.append(guest);
		    await Promise.race([ready, sleep(LOAD_MS, signal)]);
		    guest.setAudioMuted(true);
		    const loaded = new Promise((resolve) => guest.addEventListener("did-stop-loading", () => resolve(), { once: true }));
		    void guest.loadURL(url).catch(() => void 0);
		    await Promise.race([loaded, sleep(LOAD_MS, signal)]);
		    const measure = `(() => {
		      const found = ${region.find};
		      if (!found) return null;
		      const r = found.getBoundingClientRect ? found.getBoundingClientRect() : found;
		      if (r.width < 80 || r.height < 60) return null;
		      const x = Math.max(0, r.x), y = Math.max(0, r.y);
		      return { x, y, width: Math.min(r.width, innerWidth - x), height: Math.min(r.height, innerHeight - y) };
		    })()`;
		    let rect = null;
		    const deadline = Date.now() + LOAD_MS;
		    while (rect === null && Date.now() < deadline) {
		      rect = await guest.executeJavaScript(measure).catch(() => null);
		      if (rect === null) await sleep(250, signal);
		    }
		    await guest.insertCSS("::-webkit-scrollbar{display:none!important}").catch(() => "");
		    await guest.executeJavaScript("document.fonts.ready.then(() => true)").catch(() => null);
		    await sleep(SETTLE_MS, signal);
		    rect = await guest.executeJavaScript(measure).catch(() => null) ?? rect;
		    const area = rect && {
		      x: Math.round(rect.x),
		      y: Math.round(rect.y),
		      width: Math.round(rect.width),
		      height: Math.round(rect.height)
		    };
		    const take = async () => {
		      const image = await guest.capturePage(area ?? void 0);
		      if (image.isEmpty()) throw new Error("the page gave no picture");
		      return toCanvas(image);
		    };
		    let canvas = await take();
		    if (isFlat(canvas)) {
		      await sleep(BLANK_RETRY_MS, signal);
		      canvas = await take();
		    }
		    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
		    if (blob === null) throw new Error("the picture did not encode");
		    return new Uint8Array(await blob.arrayBuffer());
		  } finally {
		    guest.remove();
		    await browser.release(lease).catch(() => void 0);
		  }
		}

		var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var import_react = require("react");
		var import_jsx_runtime = require("react/jsx-runtime");
		var NS = "baoyu-design-updates";
		var HUB = Symbol.for("baoyu-design/dsh-updates");
		var DISMISSED_KEY = "baoyu-design.update.dismissed";
		var CARD_ID = "baoyu-design.update";
		var FIRST_CHECK_MS = 3e3;
		var CHECK_EVERY_MS = 6 * 60 * 6e4;
		var REASON_MAX = 240;
		function readDismissed() {
		  try {
		    return localStorage.getItem(DISMISSED_KEY) ?? "";
		  } catch {
		    return "";
		  }
		}
		function hub() {
		  const g = globalThis;
		  return g[HUB] ??= {
		    state: { updates: [], phase: "idle", step: null, to: "", restart: false, failure: null, dismissed: readDismissed() },
		    listeners: /* @__PURE__ */ new Set()
		  };
		}
		function set(patch) {
		  const h = hub();
		  h.state = { ...h.state, ...patch };
		  for (const listener of [...h.listeners]) listener();
		}
		var subscribe = (listener) => {
		  const { listeners } = hub();
		  listeners.add(listener);
		  return () => void listeners.delete(listener);
		};
		var snapshot = () => hub().state;
		var useUpdates = () => (0, import_react.useSyncExternalStore)(subscribe, snapshot);
		var latestOf = (updates) => updates.reduce((best, u) => best === "" || isNewer(u.latest, best) ? u.latest : best, "");
		var oldestOf = (updates) => updates.reduce((low, u) => low === "" || isNewer(low, u.version) ? u.version : low, "");
		var route = (path) => path.slice(1);
		async function look() {
		  try {
		    const response = await fetch(route(updatesPath), { cache: "no-store" });
		    if (!response.ok) return;
		    const { updates } = await response.json();
		    if (Array.isArray(updates) && hub().state.phase !== "running") set({ updates });
		  } catch {
		  }
		}
		function reasonOf(outcome) {
		  const { error } = outcome;
		  const refused = error?.incompatible?.[0];
		  if (refused) return `${refused.name}@${refused.version} needs ${Object.entries(refused.requirements).map(([what, range]) => `${what} ${range}`).join(", ")}`;
		  const lines = (error?.diagnostic ?? "").split("\n").map((text) => text.trim()).filter(Boolean);
		  const line = lines.find((text) => text.includes("ERR_")) ?? lines.at(-1);
		  return (line ?? error?.code ?? outcome.application ?? "unknown").slice(0, REASON_MAX);
		}
		async function install(manager, plugin, requestId) {
		  const answer = await manager.installBundle(plugin.spec, { enabled: plugin.enabled, registry: plugin.registry, requestId });
		  if (answer.ok) return answer.value;
		  const again = await manager.waitForInstall(requestId);
		  if (again.ok && again.value !== null) return again.value;
		  return { application: "failed", error: { diagnostic: answer.error.message ?? "the app did not answer" } };
		}
		async function run(manager) {
		  const plan = hub().state.updates;
		  const to = latestOf(plan);
		  let restart = false;
		  set({ phase: "running", to, restart: false, failure: null });
		  for (const [index, plugin] of plan.entries()) {
		    set({ step: { name: plugin.name, index: index + 1, total: plan.length } });
		    let outcome;
		    try {
		      outcome = await install(manager, plugin, `baoyu-design-update-${Date.now()}-${index}`);
		    } catch (error) {
		      outcome = { application: "failed", error: { diagnostic: error.message } };
		    }
		    const already = outcome.application === "failed" && outcome.error?.code === "already-installed";
		    if ((outcome.application === "failed" || outcome.application === "cancelled") && !already) {
		      set({ phase: "failed", step: null, failure: { plugin: plugin.name, message: reasonOf(outcome) } });
		      return void look();
		    }
		    restart ||= outcome.application === "restart-required";
		    set({ updates: hub().state.updates.filter((u) => u.name !== plugin.name) });
		  }
		  set({ phase: "done", step: null, restart });
		  void look();
		}
		var pluginManager;
		function start() {
		  const { phase, updates } = hub().state;
		  if (phase === "running" || updates.length === 0) return;
		  if (pluginManager === void 0) return set({ phase: "failed", failure: { plugin: updates[0].name, message: "this app has no plugin manager" } });
		  void run(pluginManager);
		}
		function dismiss() {
		  const { phase, updates } = hub().state;
		  const version = latestOf(updates);
		  if (version !== "") {
		    try {
		      localStorage.setItem(DISMISSED_KEY, version);
		    } catch {
		    }
		  }
		  set({ phase: phase === "running" ? phase : "idle", failure: null, ...version === "" ? {} : { dismissed: version } });
		}
		var zh = {
		  "available": "baoyu-design 插件有新版本 {version}",
		  "current": "当前是 {version}。",
		  "changelog": "更新内容",
		  "changelog.url": "https://github.com/JimLiu/baoyu-design/blob/main/CHANGELOG.zh.md",
		  "update": "更新",
		  "update.label": "更新 baoyu-design 插件到 {version}",
		  "later": "稍后",
		  "running": "正在更新 {plugin}（{index}/{total}）…",
		  "busy": "正在更新…",
		  "done": "已更新到 {version}。",
		  "done.session": "新开的会话会用新版本。",
		  "done.restart": "退出 DSH 再重新打开后生效。",
		  "failed": "{plugin} 没有更新成功",
		  "failed.kept": "它还是原来的版本。",
		  "retry": "重试",
		  "close": "关闭",
		  "tag": "有新版本 {version}"
		};
		var en = {
		  "available": "baoyu-design plugins {version} is available",
		  "current": "You have {version}.",
		  "changelog": "What's new",
		  "changelog.url": "https://github.com/JimLiu/baoyu-design/blob/main/CHANGELOG.md",
		  "update": "Update",
		  "update.label": "Update the baoyu-design plugins to {version}",
		  "later": "Later",
		  "running": "Updating {plugin} ({index}/{total})…",
		  "busy": "Updating…",
		  "done": "Updated to {version}.",
		  "done.session": "New sessions use it.",
		  "done.restart": "Quit DSH and open it again to finish.",
		  "failed": "{plugin} did not update",
		  "failed.kept": "It stays on the version it was.",
		  "retry": "Try again",
		  "close": "Close",
		  "tag": "New version {version}"
		};
		var CSS = `
		.bdu-card{position:fixed;right:20px;bottom:20px;z-index:950;box-sizing:border-box;width:min(360px,calc(100vw - 40px));padding:14px 16px;
		  border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl,12px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
		  box-shadow:0 8px 28px rgba(0,0,0,.14);font-size:13px;line-height:20px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
		.bdu-title{font-weight:500;overflow-wrap:anywhere}
		.bdu-text{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
		.bdu-text a,.bdu-bar a{color:var(--dsw-alias-state-business-primary);text-decoration:none}
		.bdu-text a:hover,.bdu-bar a:hover{text-decoration:underline}
		.bdu-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
		.bdu-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:-8px 0 20px;padding:10px 14px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover);font-size:13px;line-height:20px}
		.bdu-bar-text{flex:1;min-width:200px;overflow-wrap:anywhere}
		.bdu-bar-note{color:var(--dsw-alias-label-secondary);margin-left:6px}
		`;
		var pluginTitle = (name) => name.replace(/^dsh-/, "");
		function UpdateCard({ t, startUpdate }) {
		  const { phase, updates, step, to, restart, failure, dismissed } = useUpdates();
		  const latest = latestOf(updates);
		  const offer = phase === "idle" && latest !== "" && latest !== dismissed;
		  if (phase === "idle" && !offer) return null;
		  let title;
		  let text = null;
		  let actions = null;
		  if (phase === "running") {
		    title = step ? t("running", { plugin: pluginTitle(step.name), index: String(step.index), total: String(step.total) }) : t("busy");
		  } else if (phase === "done") {
		    title = t("done", { version: to });
		    text = t(restart ? "done.restart" : "done.session");
		    actions = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: dismiss, children: t("close") });
		  } else if (phase === "failed" && failure) {
		    title = t("failed", { plugin: pluginTitle(failure.plugin) });
		    text = `${failure.message} ${t("failed.kept")}`;
		    actions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: dismiss, children: t("close") }),
		      updates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", size: "sm", onClick: startUpdate, children: t("retry") })
		    ] });
		  } else {
		    title = t("available", { version: latest });
		    text = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		      t("current", { version: oldestOf(updates) }),
		      " ",
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: t("changelog.url"), target: "_blank", rel: "noreferrer", children: t("changelog") })
		    ] });
		    actions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: dismiss, children: t("later") }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", size: "sm", onClick: startUpdate, children: t("update") })
		    ] });
		  }
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bdu-card", role: phase === "failed" ? "alert" : "status", "data-testid": "baoyu-design-update", "data-phase": phase, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdu-title", children: title }),
		    text !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdu-text", children: text }),
		    actions !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdu-actions", children: actions })
		  ] });
		}
		function UpdateBar({ updates: offer }) {
		  const { phase, updates } = useUpdates();
		  const latest = latestOf(updates);
		  if (phase !== "running" && latest === "") return null;
		  const { t, start: startUpdate } = offer;
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdu-bar", "data-testid": "baoyu-design-update-bar", children: phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bdu-bar-text", children: t("busy") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "bdu-bar-text", children: [
		      t("available", { version: latest }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "bdu-bar-note", children: [
		        t("current", { version: oldestOf(updates) }),
		        " ",
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: t("changelog.url"), target: "_blank", rel: "noreferrer", children: t("changelog") })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", size: "sm", onClick: startUpdate, children: t("update") })
		  ] }) });
		}
		var Refresh = import_dsh_client_ui_primitives.IconRefreshOutlineRegular;
		function DetailAction({ subject, t, startUpdate }) {
		  const { phase, updates } = useUpdates();
		  const update = updates.find((u) => u.name === subject?.pkg?.name);
		  if (subject?.kind !== "bundle" || update === void 0) return null;
		  const running = phase === "running";
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		    import_dsh_client_ui_primitives.Button,
		    {
		      variant: "outline",
		      size: "sm",
		      ...Refresh ? { icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Refresh, { size: 13 }) } : {},
		      disabled: running,
		      "aria-label": t("update.label", { version: latestOf(updates) }),
		      "data-testid": "baoyu-design-update-action",
		      onClick: startUpdate,
		      children: t(running ? "busy" : "update")
		    }
		  );
		}
		function DetailBadge({ subject, t }) {
		  const { updates } = useUpdates();
		  const update = updates.find((u) => u.name === subject?.pkg?.name);
		  if (subject?.kind !== "bundle" || update === void 0) return null;
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "info", children: t("tag", { version: update.latest }) });
		}
		function pageUpdates(ctx) {
		  return { t: ctx.locale.bind?.(NS) ?? ((key) => en[key] ?? key), start };
		}
		function joinUpdates(ctx, plugin) {
		  ctx.effect(() => {
		    if (typeof document === "undefined") return () => {
		    };
		    const tag = document.createElement("style");
		    tag.dataset.plugin = plugin;
		    tag.dataset.pluginCss = `${plugin}/updates.css`;
		    tag.textContent = CSS;
		    document.head.appendChild(tag);
		    return () => tag.remove();
		  }, `${plugin}: update styles`);
		  ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${plugin}: update dictionaries`);
		  ctx.effect(() => {
		    const first = setTimeout(() => void look(), FIRST_CHECK_MS);
		    const every = setInterval(() => void look(), CHECK_EVERY_MS);
		    return () => {
		      clearTimeout(first);
		      clearInterval(every);
		    };
		  }, `${plugin}: looking for updates`);
		  ctx.inject?.(["remote", "remote.pluginManager"], (sub) => {
		    pluginManager = sub.remote.pluginManager;
		    sub.effect(() => () => {
		      pluginManager = void 0;
		    }, `${plugin}: the plugin manager`);
		  });
		  const inject2 = () => ({ startUpdate: start });
		  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: CARD_ID, locale: NS, inject: inject2 }, UpdateCard));
		  ctx.slots.inject("plugins.detail.actions", () => ctx.slots.register({ name: "plugins.detail.actions", id: CARD_ID, locale: NS, inject: inject2 }, DetailAction));
		  ctx.slots.inject("plugins.detail.badge", () => ctx.slots.register({ name: "plugins.detail.badge", id: CARD_ID, locale: NS, inject: inject2 }, DetailBadge));
		}

		var import_jsx_runtime2 = require("react/jsx-runtime");
		var PAGE_VERSION = 4;
		var PANEL_ID = "baoyu-design.artifacts";
		var NS2 = "baoyu-design-artifacts";
		var VIEW_KEY = "baoyu-design.artifacts.view";
		var HUB2 = Symbol.for("baoyu-design/dsh-artifacts-page");
		function hub2() {
		  const g = globalThis;
		  return g[HUB2] ??= { members: /* @__PURE__ */ new Map(), owner: null, listeners: /* @__PURE__ */ new Set() };
		}
		function newest(h) {
		  let best;
		  for (const m of h.members.values()) if (best === void 0 || m.version > best.version) best = m;
		  return best;
		}
		function settle(h) {
		  const next = newest(h);
		  if (h.owner !== null && h.members.has(h.owner.plugin) && (next === void 0 || next.version <= h.owner.version)) return;
		  if (h.owner !== null) {
		    const old = h.owner;
		    h.owner = null;
		    old.dispose();
		  }
		  if (next === void 0) return;
		  try {
		    h.owner = { plugin: next.plugin, version: next.version, dispose: next.mount() };
		  } catch (error) {
		    console.error(`${next.plugin}: the Artifacts page did not register:`, error);
		  }
		}
		function changed(h) {
		  for (const listener of [...h.listeners]) {
		    try {
		      listener();
		    } catch (error) {
		      console.error("baoyu-design Artifacts page listener failed:", error);
		    }
		  }
		}
		function createStore(initial) {
		  let state = initial;
		  const listeners = /* @__PURE__ */ new Set();
		  return {
		    getSnapshot: () => state,
		    subscribe(listener) {
		      listeners.add(listener);
		      return () => listeners.delete(listener);
		    },
		    set(patch) {
		      state = { ...state, ...patch };
		      for (const listener of [...listeners]) listener();
		    }
		  };
		}
		var EMPTY_SESSIONS = { getSnapshot: () => ({}), subscribe: () => () => {
		} };
		function isStore(value) {
		  const v = value;
		  return typeof v?.getSnapshot === "function" && typeof v.subscribe === "function";
		}
		function linkState(id, sessions, workspaces) {
		  if (sessions === void 0) return "unavailable";
		  if (workspaces?.state === "error") return "unavailable";
		  if (sessions.phase === "pending" || workspaces?.phase === "pending") return "loading";
		  if (workspaces?.archivedSessionIds?.includes(id)) return "archived";
		  if (!sessions.ids?.includes(id)) return "unavailable";
		  return "available";
		}
		var zh2 = {
		  panel: "作品",
		  title: "作品",
		  "time.locale": "zh-CN",
		  search: "搜索作品",
		  "search.clear": "清除搜索",
		  "type.claude-slides": "幻灯片",
		  "type.claude-design": "设计",
		  "type.claude-design-system": "设计系统",
		  "type.claude-dashboard": "看板",
		  "type.claude-docs": "文档",
		  "type.claude-motion": "动画",
		  "create.heading": "新建",
		  "create.new": "新建",
		  "create.session": "新会话",
		  "prompt.claude-slides": "帮我做一份幻灯片，主题是：",
		  "prompt.claude-design": "帮我设计：",
		  "prompt.claude-design-system": "帮我做一套设计系统，品牌是：",
		  "prompt.claude-dashboard": "帮我做一个数据看板，数据是：",
		  "prompt.claude-docs": "帮我写一份文档，内容是：",
		  "prompt.claude-motion": "帮我做一段动画，内容是：",
		  "view.list": "列表视图",
		  "view.grid": "网格视图",
		  "filter.button": "排序和筛选",
		  "filter.sort": "排序方式",
		  "filter.type": "类型",
		  "filter.date": "打开时间",
		  "filter.sharing": "共享",
		  "filter.pinned": "已固定",
		  "filter.any": "不限",
		  "filter.some": "{count} 项",
		  "filter.clear": "清除筛选",
		  "sort.opened": "最近打开",
		  "sort.updated": "最近修改",
		  "sort.created": "创建时间",
		  "sort.name": "名称",
		  "date.any": "不限",
		  "date.today": "今天",
		  "date.yesterday": "昨天",
		  "date.week": "最近 7 天",
		  "date.month": "最近 30 天",
		  "sharing.any": "不限",
		  "sharing.shared": "已共享",
		  "sharing.private": "未共享",
		  "card.opened": "{time}打开",
		  "card.justNow": "刚刚打开",
		  "card.opening": "正在打开…",
		  "card.shared": "已在局域网共享",
		  "action.more": "更多操作",
		  "action.pin": "固定",
		  "action.unpin": "取消固定",
		  "action.rename": "重命名",
		  "action.copy": "复制链接",
		  "action.delete": "删除",
		  "rename.title": "重命名作品",
		  "rename.save": "保存",
		  "dialog.cancel": "取消",
		  "delete.title": "删除“{title}”？",
		  "delete.moves": "这会移除这个作品，它的文件夹移到应用数据目录下的 baoyu-design/trash。",
		  "delete.keeps": "这会把它从作品里移除。它的文件夹里还有别的文件，所以留在原处：{path}",
		  "delete.confirm": "删除",
		  "toast.copied": "链接已复制到剪贴板。",
		  "toast.deleted": "已删除“{title}”。",
		  "toast.removed": "已从作品里移除“{title}”，文件夹还在原处。",
		  "toast.undo": "撤销",
		  "toast.close": "关闭",
		  "empty.title": "还没有作品",
		  "empty.body": "Agent 用 baoyu-design 的技能做出来的东西都会出现在这里。点上面的入口开始做一个。",
		  "empty.noMatches": "没有符合条件的作品",
		  "load.error": "读取作品列表失败：{message}",
		  "load.retry": "重试",
		  "open.pluginOff": "没有安装 {plugin} 插件，打不开这个作品。",
		  "open.failed": "打不开：{message}",
		  "open.noSession": "原来的对话已不在，编辑器在新窗口里打开了。",
		  "action.failed": "没有做成：{message}"
		};
		var en2 = {
		  panel: "Artifacts",
		  title: "Artifacts",
		  "time.locale": "en",
		  search: "Search artifacts",
		  "search.clear": "Clear search",
		  "type.claude-slides": "Slides",
		  "type.claude-design": "Design",
		  "type.claude-design-system": "Design system",
		  "type.claude-dashboard": "Dashboard",
		  "type.claude-docs": "Docs",
		  "type.claude-motion": "Motion",
		  "create.heading": "Make something new",
		  "create.new": "New",
		  "create.session": "New session",
		  "prompt.claude-slides": "Make me a slide deck about: ",
		  "prompt.claude-design": "Design this for me: ",
		  "prompt.claude-design-system": "Make me a design system for this brand: ",
		  "prompt.claude-dashboard": "Make me a dashboard from this data: ",
		  "prompt.claude-docs": "Write me a doc about: ",
		  "prompt.claude-motion": "Make me an animation about: ",
		  "view.list": "List view",
		  "view.grid": "Grid view",
		  "filter.button": "Sort and filter",
		  "filter.sort": "Sort by",
		  "filter.type": "Type",
		  "filter.date": "Date opened",
		  "filter.sharing": "Sharing",
		  "filter.pinned": "Pinned",
		  "filter.any": "Any",
		  "filter.some": "{count} selected",
		  "filter.clear": "Clear filters",
		  "sort.opened": "Last opened",
		  "sort.updated": "Last edited",
		  "sort.created": "Date created",
		  "sort.name": "Name",
		  "date.any": "Any time",
		  "date.today": "Today",
		  "date.yesterday": "Yesterday",
		  "date.week": "Past 7 days",
		  "date.month": "Past 30 days",
		  "sharing.any": "Any",
		  "sharing.shared": "Shared",
		  "sharing.private": "Not shared",
		  "card.opened": "Opened {time}",
		  "card.justNow": "Opened just now",
		  "card.opening": "Opening…",
		  "card.shared": "Shared on the local network",
		  "action.more": "More actions",
		  "action.pin": "Pin",
		  "action.unpin": "Unpin",
		  "action.rename": "Rename",
		  "action.copy": "Copy link",
		  "action.delete": "Delete",
		  "rename.title": "Rename artifact",
		  "rename.save": "Save",
		  "dialog.cancel": "Cancel",
		  "delete.title": "Delete {title}?",
		  "delete.moves": "This removes the artifact and moves its folder to baoyu-design/trash in the app's data folder.",
		  "delete.keeps": "This takes it off your artifacts. Its folder holds other files too, so it stays where it is: {path}",
		  "delete.confirm": "Delete",
		  "toast.copied": "Link copied to clipboard.",
		  "toast.deleted": "Deleted “{title}”.",
		  "toast.removed": "Took “{title}” off your artifacts. Its folder stays where it is.",
		  "toast.undo": "Undo",
		  "toast.close": "Close",
		  "empty.title": "No artifacts yet",
		  "empty.body": "What the agent makes with a baoyu-design skill shows up here. Start one with a tile above.",
		  "empty.noMatches": "No artifacts match",
		  "load.error": "Could not read the artifacts: {message}",
		  "load.retry": "Try again",
		  "open.pluginOff": "The {plugin} plugin is not installed, so this artifact cannot open.",
		  "open.failed": "Could not open it: {message}",
		  "open.noSession": "The conversation is gone, so the editor opened in a new window.",
		  "action.failed": "That did not work: {message}"
		};
		var SKILLS = ["claude-docs", "claude-slides", "claude-design", "claude-dashboard", "claude-design-system", "claude-motion"];
		var isSkill = (s) => SKILLS.includes(s);
		var creatable = (on) => SKILLS.filter((s) => on.includes(s));
		var promptFor = (skill, t) => `/${skill} ${t(`prompt.${skill}`)}`;
		var NO_FILTERS = { sort: "opened", types: [], date: "any", sharing: "any", pinned: false };
		var SORTS = ["opened", "updated", "created", "name"];
		var DATES = ["any", "today", "yesterday", "week", "month"];
		var SHARINGS = ["any", "shared", "private"];
		var isFiltered = (f) => f.types.length > 0 || f.date !== "any" || f.sharing !== "any" || f.pinned;
		function inRange(iso, range, now) {
		  if (range === "any") return true;
		  const then = Date.parse(iso);
		  if (!Number.isFinite(then)) return false;
		  const day = new Date(now);
		  const today = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
		  const DAY = 864e5;
		  switch (range) {
		    case "today":
		      return then >= today;
		    case "yesterday":
		      return then >= new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1).getTime() && then < today;
		    case "week":
		      return then >= now - 7 * DAY;
		    case "month":
		      return then >= now - 30 * DAY;
		  }
		}
		function sorted(views, sort, locale) {
		  const by = (key) => (a, b) => a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0;
		  const compare = sort === "name" ? (a, b) => a.title.localeCompare(b.title, locale) : by(sort === "updated" ? "updatedAt" : sort === "created" ? "firstOpenedAt" : "openedAt");
		  return [...views].sort(compare);
		}
		var CSS2 = `
		.bda-page{position:relative;width:100%;min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;display:flex;flex-direction:column;overflow:hidden}
		.bda-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
		.bda-content{max-width:1120px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 56px}
		.bda-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px;padding-top:28px;margin-bottom:24px}
		[data-platform=darwin] .bda-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
		.bda-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
		.bda-tools{display:flex;align-items:center;gap:4px;margin-left:auto}
		.bda-tool{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
		.bda-tool:hover,.bda-tool[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
		.bda-tool[data-active=true]::after{content:"";position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
		.bda-search{display:flex;align-items:center;gap:6px;width:min(240px,50vw);height:32px;padding:0 8px 0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-tertiary)}
		.bda-search:focus-within{border-color:var(--dsw-alias-state-business-primary)}
		.bda-search input{flex:1;min-width:0;height:100%;border:0;padding:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
		.bda-search input::placeholder{color:var(--dsw-alias-label-caption)}
		.bda-search input::-webkit-search-cancel-button{display:none}
		.bda-search button{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:-4px;padding:0;border:0;border-radius:6px;background:none;color:inherit;cursor:pointer}
		.bda-search button:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-section-title{margin:0 0 12px;font-size:13px;font-weight:400;line-height:20px;color:var(--dsw-alias-label-tertiary)}
		.bda-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:14px;margin:0 0 36px;padding:0;list-style:none}
		.bda-tile{display:flex;flex-direction:column;gap:8px;width:100%;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
		.bda-tile-art{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:7/5;border-radius:14px;overflow:hidden;background:color-mix(in srgb,var(--bda-tint) 24%,var(--dsw-alias-bg-base));color:color-mix(in srgb,var(--bda-tint) 78%,var(--dsw-alias-label-primary));transition:background-color .15s}
		.bda-tile:hover .bda-tile-art{background:color-mix(in srgb,var(--bda-tint) 34%,var(--dsw-alias-bg-base))}
		.bda-tile:focus-visible{outline:none}
		.bda-tile:focus-visible .bda-tile-art{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
		.bda-tile-squiggle{position:absolute;inset:0;width:100%;height:100%;opacity:.28}
		.bda-tile-label{padding-left:2px;font-size:14px;line-height:20px}
		.bda-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin:0;padding:0;list-style:none}
		.bda-item{position:relative;min-width:0}
		.bda-card{display:flex;flex-direction:column;width:100%;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background-color .15s}
		.bda-item:hover .bda-card{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-card:disabled{cursor:progress}
		.bda-card:focus-visible,.bda-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
		.bda-preview{position:relative;display:block;width:100%;aspect-ratio:2/1;overflow:hidden;background:color-mix(in srgb,var(--bda-tint) 16%,var(--dsw-alias-bg-base))}
		.bda-sheet{position:absolute;left:12%;right:12%;top:13%;bottom:-8px;border-radius:8px 8px 0 0;overflow:hidden;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 6px 18px -8px rgba(0,0,0,.28);transition:transform .2s}
		.bda-item:hover .bda-sheet{transform:translateY(-3px)}
		.bda-sheet img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center;user-select:none}
		.bda-preview[data-stack=true] .bda-sheet{left:20%;right:20%}
		.bda-preview[data-stack=true]::before{content:"";position:absolute;left:21%;right:19%;top:10%;bottom:-8px;border-radius:8px 8px 0 0;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2);transform:rotate(1.6deg);transform-origin:bottom center}
		.bda-paper{position:absolute;left:14%;right:14%;top:13%;bottom:-8px;border-radius:8px 8px 0 0;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 6px 18px -8px rgba(0,0,0,.25);padding:6% 7% 0;display:flex;flex-direction:column;gap:6px;overflow:hidden;transition:transform .2s}
		.bda-item:hover .bda-paper{transform:translateY(-3px)}
		.bda-paper-title{font-size:11px;line-height:1.35;font-weight:600;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
		.bda-line{height:5px;border-radius:3px;background:var(--dsw-alias-border-l2)}
		.bda-slide{position:absolute;left:14%;right:14%;top:13%;aspect-ratio:16/9;border-radius:6px;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 6px 18px -8px rgba(0,0,0,.25);display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 9%;transition:transform .2s}
		.bda-item:hover .bda-slide{transform:translateY(-3px)}
		.bda-slide .bda-paper-title{font-size:12px}
		.bda-slide .bda-line{width:40%;background:var(--bda-tint);opacity:.55}
		.bda-boards{display:flex;gap:6px;flex:1;margin-top:2px}
		.bda-board{flex:1;border-radius:3px;background:color-mix(in srgb,var(--bda-tint) 18%,var(--dsw-alias-bg-base));box-shadow:0 0 0 .5px var(--dsw-alias-border-l2)}
		.bda-board:nth-child(2){flex:.7;margin-top:10%}
		.bda-swatches{display:flex;gap:4px}
		.bda-swatch{width:16px;height:16px;border-radius:50%;background:var(--bda-tint)}
		.bda-swatch:nth-child(2){opacity:.7}.bda-swatch:nth-child(3){opacity:.45}.bda-swatch:nth-child(4){opacity:.25}
		.bda-specimen{font-size:20px;line-height:1;font-weight:600;color:var(--dsw-alias-label-secondary)}
		.bda-kpis{display:flex;gap:5px}
		.bda-kpi{flex:1;height:16px;border-radius:3px;box-shadow:0 0 0 .5px var(--dsw-alias-border-l2)}
		.bda-bars{display:flex;align-items:flex-end;gap:5px;height:34%;margin-top:2px}
		.bda-bar{flex:1;border-radius:2px 2px 0 0;background:var(--bda-tint);opacity:.7}
		.bda-film{position:absolute;left:14%;right:14%;top:13%;aspect-ratio:16/9;border-radius:6px;background:#1d1d1f;box-shadow:0 6px 18px -8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:transform .2s;color:#fff}
		.bda-item:hover .bda-film{transform:translateY(-3px)}
		.bda-film-bar{position:absolute;left:8%;right:8%;bottom:10%;height:3px;border-radius:2px;background:rgba(255,255,255,.25)}
		.bda-film-bar::after{content:"";position:absolute;left:0;top:0;bottom:0;width:38%;border-radius:2px;background:var(--bda-tint)}
		.bda-film-title{position:absolute;left:8%;right:8%;top:10%;font-size:10px;font-weight:600;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 70%,transparent);color:var(--dsw-alias-label-secondary);font-size:13px}
		.bda-spinner{width:14px;height:14px;border-radius:50%;border:1.5px solid currentColor;border-right-color:transparent;animation:bda-spin .8s linear infinite}
		@keyframes bda-spin{to{transform:rotate(360deg)}}
		.bda-info{display:flex;align-items:center;gap:12px;min-width:0;padding:12px 14px}
		.bda-glyph{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;background:color-mix(in srgb,var(--bda-tint) 16%,var(--dsw-alias-bg-base));color:color-mix(in srgb,var(--bda-tint) 78%,var(--dsw-alias-label-primary))}
		.bda-text{display:flex;flex-direction:column;min-width:0;flex:1}
		.bda-name{font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-actions{position:absolute;top:10px;right:10px;display:flex;align-items:center;gap:6px}
		.bda-act{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;transition:opacity .12s}
		.bda-act:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,var(--dsw-alias-bg-base))}
		.bda-item:hover .bda-act,.bda-item:focus-within .bda-act,.bda-act[aria-expanded=true],.bda-act[data-on=true]{opacity:1}
		.bda-act[data-on=true]{color:var(--dsw-alias-label-primary)}
		.bda-list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
		.bda-list .bda-item{display:flex;align-items:center;border-radius:10px;padding-right:8px}
		.bda-list .bda-item:hover,.bda-list .bda-item[data-menu=true]{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-row{display:flex;align-items:center;gap:12px;flex:1;min-width:0;padding:8px 10px;border:0;border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
		.bda-row:disabled{cursor:progress}
		.bda-row .bda-name{flex:1;min-width:0}
		.bda-row .bda-meta{flex:none;margin-left:16px}
		.bda-row-tools{flex:none;display:flex;align-items:center;gap:2px;margin-left:4px;color:var(--dsw-alias-label-tertiary)}
		.bda-shared{display:inline-flex;align-items:center;margin-right:6px;color:var(--dsw-alias-label-tertiary)}
		.bda-list .bda-act{width:28px;height:28px;border:0;background:none}
		.bda-list .bda-act:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
		.bda-list .bda-act-more{opacity:1}
		@media (max-width:560px){.bda-row .bda-meta{display:none}}
		.bda-menu{position:fixed;z-index:1000;min-width:200px;padding:6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 8px 28px -6px rgba(0,0,0,.28);font-size:14px}
		.bda-menu-item{display:flex;align-items:center;gap:10px;width:100%;min-height:34px;padding:5px 10px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;white-space:nowrap;cursor:pointer}
		.bda-menu-item:hover,.bda-menu-item:focus-visible,.bda-menu-item[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);outline:none}
		.bda-menu-item[data-danger=true]{color:var(--dsw-alias-state-error-primary)}
		.bda-menu-item svg{flex:none}
		.bda-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
		.bda-menu-value{margin-left:16px;color:var(--dsw-alias-label-tertiary)}
		.bda-menu-count{margin-left:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
		.bda-menu-key{margin-left:20px;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px}
		.bda-menu-rule{height:.5px;margin:6px 4px;background:var(--dsw-alias-border-l2)}
		.bda-menu-chev{margin-left:6px;color:var(--dsw-alias-label-tertiary)}
		.bda-menu-row{position:relative}
		.bda-submenu{position:absolute;left:calc(100% + 12px);top:-6px;z-index:1001;min-width:190px;padding:6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 8px 28px -6px rgba(0,0,0,.28)}
		.bda-submenu[data-flip=true]{left:auto;right:calc(100% + 12px)}
		.bda-check{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;color:transparent}
		.bda-check[data-on=true]{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-primary);color:#fff}
		.bda-tick{flex:none;margin-left:16px;color:var(--dsw-alias-state-business-primary)}
		.bda-scrim{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.36)}
		.bda-dialog{width:min(420px,100%);padding:20px;border-radius:16px;background:var(--dsw-alias-bg-base);box-shadow:0 18px 48px -12px rgba(0,0,0,.4)}
		.bda-dialog h2{margin:0 0 12px;font-size:16px;font-weight:600;line-height:24px;overflow-wrap:anywhere}
		.bda-dialog p{margin:0;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1.55;overflow-wrap:anywhere}
		.bda-dialog input{box-sizing:border-box;width:100%;height:38px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:none;color:var(--dsw-alias-label-primary);font:inherit;outline:none}
		.bda-dialog input:focus{border-color:var(--dsw-alias-state-business-primary)}
		.bda-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
		.bda-btn{height:34px;padding:0 14px;border:0;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font:inherit;font-weight:500;cursor:pointer}
		.bda-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,var(--dsw-alias-bg-base))}
		.bda-btn:disabled{color:var(--dsw-alias-label-caption);cursor:default;background:var(--dsw-alias-interactive-bg-hover)}
		.bda-btn[data-primary=true]{background:var(--dsw-alias-state-business-primary);color:#fff}
		.bda-btn[data-primary=true]:hover:not(:disabled){filter:brightness(1.08)}
		.bda-btn[data-primary=true]:disabled{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-caption)}
		.bda-btn[data-danger=true]{border:1px solid var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-alias-bg-base));color:var(--dsw-alias-state-error-primary)}
		.bda-btn[data-danger=true]:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,var(--dsw-alias-bg-base))}
		.bda-toast{position:absolute;left:50%;bottom:24px;z-index:900;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100% - 32px));padding:9px 10px 9px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 8px 28px -6px rgba(0,0,0,.28);transform:translateX(-50%);font-size:14px}
		.bda-toast[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
		.bda-toast svg{flex:none}
		.bda-toast-text{min-width:0;overflow-wrap:anywhere}
		.bda-toast-undo{flex:none;padding:2px 8px;border:0;border-radius:6px;background:none;color:var(--dsw-alias-state-business-primary);font:inherit;font-weight:500;cursor:pointer}
		.bda-toast-undo:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-toast-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:var(--dsw-alias-label-tertiary);cursor:pointer}
		.bda-toast-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:56px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
		.bda-empty svg{color:var(--dsw-alias-label-caption);margin-bottom:4px}
		.bda-empty h2{margin:0;font-size:14px;font-weight:500;color:var(--dsw-alias-label-secondary)}
		.bda-empty p{margin:0;max-width:420px;font-size:13px;line-height:1.6}
		.bda-retry{margin-top:8px;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:15px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
		.bda-retry:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-skeleton .bda-card{cursor:default}
		.bda-skeleton .bda-preview{background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-interactive-bg-hover))}
		.bda-skeleton .bda-line{width:60%;height:10px;margin:18px 14px}
		@media (prefers-reduced-motion:reduce){.bda-sheet,.bda-paper,.bda-slide,.bda-film,.bda-act,.bda-tile-art,.bda-card{transition:none}.bda-spinner{animation-duration:2s}}
		`;
		var TINTS = {
		  "claude-slides": "#e8703a",
		  "claude-design": "#7a5cf0",
		  "claude-design-system": "#c79a1b",
		  "claude-dashboard": "#e5484d",
		  "claude-docs": "#3f8ef0",
		  "claude-motion": "#1fa971"
		};
		var tintOf = (skill) => isSkill(skill) ? TINTS[skill] : "#8a8a8a";
		var svg = (size) => ({ display: "block", width: size, height: size, flex: "none" });
		function ArtifactsIcon({ size = 16 }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", style: svg(size), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "3", y: "6", width: "8.5", height: "11", rx: "2", stroke: "currentColor", strokeWidth: "1.5" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8.5 6V5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3.5", stroke: "currentColor", strokeWidth: "1.5" })
		  ] });
		}
		function TypeIcon({ skill, size = 18 }) {
		  const p = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
		  const body = (() => {
		    switch (skill) {
		      case "claude-slides":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.75 3.5h14.5M4 3.5v8.25a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3.5M7.25 16.75 10 12.75l2.75 4", ...p }) });
		      case "claude-design":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M10 2.75a7.25 7.25 0 1 0 0 14.5c1.1 0 1.75-.8 1.75-1.7 0-.5-.2-.9-.45-1.25-.25-.35-.45-.7-.45-1.15 0-.95.75-1.65 1.7-1.65h1.6a3.1 3.1 0 0 0 3.1-3.1c0-3.1-3.2-5.65-7.25-5.65Z", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6.4", cy: "9.4", r: ".9", fill: "currentColor" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "8.8", cy: "6.3", r: ".9", fill: "currentColor" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12.5", cy: "6.8", r: ".9", fill: "currentColor" })
		        ] });
		      case "claude-design-system":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6.5", cy: "6.5", r: "3.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "13.5", cy: "6.5", r: "3.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "10", cy: "13", r: "3.25", ...p })
		        ] });
		      case "claude-dashboard":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2.75", y: "10", width: "4.5", height: "7.25", rx: "1", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "7.75", y: "2.75", width: "4.5", height: "14.5", rx: "1", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "12.75", y: "7", width: "4.5", height: "10.25", rx: "1", ...p })
		        ] });
		      case "claude-docs":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5.5 2.75h6l4 4v9.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M11.5 2.75v4h4", ...p })
		        ] });
		      case "claude-motion":
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2.75", y: "4", width: "14.5", height: "12", rx: "2", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "m8.5 7.75 4 2.25-4 2.25v-4.5Z", ...p })
		        ] });
		      default:
		        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "3", y: "3", width: "14", height: "14", rx: "2", ...p });
		    }
		  })();
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", style: svg(size), children: body });
		}
		function Icon({ d, size = 16, fill }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 16 16", fill: fill ? "currentColor" : "none", stroke: fill ? void 0 : "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: svg(size), children: typeof d === "string" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d }) : d });
		}
		var ICON = {
		  search: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "7", cy: "7", r: "4.5" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "m10.5 10.5 3 3" })
		  ] }),
		  clear: "m4.5 4.5 7 7m0-7-7 7",
		  filter: "M2.5 4.5h11M4.5 8h7M6.5 11.5h3",
		  list: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5.75 4h7.75M5.75 8h7.75M5.75 12h7.75" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.5 4h.01M2.5 8h.01M2.5 12h.01", strokeWidth: "1.8" })
		  ] }),
		  grid: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2.5", y: "2.5", width: "4.5", height: "4.5", rx: "1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "9", y: "2.5", width: "4.5", height: "4.5", rx: "1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2.5", y: "9", width: "4.5", height: "4.5", rx: "1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "9", y: "9", width: "4.5", height: "4.5", rx: "1" })
		  ] }),
		  plus: "M8 3v10M3 8h10",
		  chat: "M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.2L5.4 13.8a.3.3 0 0 1-.5-.23V11.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z",
		  pin: "M9.75 2.25 13.75 6.25M10.75 3.25 7 6.25 4.5 6.5 9.5 11.5 9.75 9 12.75 5.25M7 9l-4 4",
		  more: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "3.5", cy: "8", r: ".6", fill: "currentColor" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "8", cy: "8", r: ".6", fill: "currentColor" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12.5", cy: "8", r: ".6", fill: "currentColor" })
		  ] }),
		  rename: "M10.5 3 13 5.5 5.5 13 2.5 13.5 3 10.5 10.5 3Z",
		  link: "M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2.25-2.25a2.5 2.5 0 0 0-3.54-3.54L8.25 4.2M9.25 6.75a2.5 2.5 0 0 0-3.54 0L3.46 9a2.5 2.5 0 0 0 3.54 3.54l.75-.75",
		  trash: "M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25M4 4.25l.6 8.6a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.6M6.75 7v4M9.25 7v4",
		  info: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "8", cy: "8", r: "6" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8 7.5v3.25M8 5.25h.01" })
		  ] }),
		  chevron: "m6 3.5 4.5 4.5L6 12.5",
		  tick: "m3 8.5 3.25 3.25L13 4.75",
		  people: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6", cy: "5.5", r: "2.25" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2 13c0-2.2 1.8-3.75 4-3.75S10 10.8 10 13M10.5 3.5a2.25 2.25 0 0 1 0 4M12 9.5c1.3.45 2.25 1.75 2.25 3.5" })
		  ] })
		};
		function Drawn({ skill, title }) {
		  const name = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-paper-title", children: title });
		  switch (skill) {
		    case "claude-slides":
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-slide", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-line" })
		      ] });
		    case "claude-motion":
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-film", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-film-title", children: title }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 20 20", "aria-hidden": "true", style: svg(22), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 5.5v9l7.5-4.5L7 5.5Z", fill: "currentColor" }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-film-bar" })
		      ] });
		    case "claude-design":
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-boards", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-board" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-board" })
		        ] })
		      ] });
		    case "claude-design-system":
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-swatches", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-swatch" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-specimen", children: "Aa" })
		      ] });
		    case "claude-dashboard":
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-kpis", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-kpi" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-kpi" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-kpi" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-bars", children: [45, 70, 55, 90, 65, 80].map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-bar", style: { height: `${h}%` } }, i)) })
		      ] });
		    default:
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        [92, 100, 84, 96, 70].map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-line", style: { width: `${w}%` } }, i))
		      ] });
		  }
		}
		function Preview({ view, thumbnailUrl }) {
		  const url = thumbnailUrl(view);
		  const [broken, setBroken] = (0, import_react2.useState)(null);
		  const shown = url !== null && broken !== url;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-preview", "data-stack": shown && view.skill === "claude-docs", children: shown ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-sheet", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { src: url, alt: "", draggable: false, onError: () => setBroken(url) }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Drawn, { skill: view.skill, title: view.title }) });
		}
		function ago(iso, now, t) {
		  const then = Date.parse(iso);
		  if (!Number.isFinite(then)) return "";
		  const seconds = Math.round((then - now) / 1e3);
		  if (seconds > -60) return t("card.justNow");
		  const steps = [["minute", 60], ["hour", 3600], ["day", 86400], ["week", 604800], ["month", 2629800], ["year", 31557600]];
		  let unit = "minute";
		  let size = 60;
		  for (const [u, s] of steps) if (-seconds >= s) [unit, size] = [u, s];
		  let format;
		  try {
		    format = new Intl.RelativeTimeFormat(t("time.locale"), { numeric: "auto" });
		  } catch {
		    format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
		  }
		  return t("card.opened", { time: format.format(Math.round(seconds / size), unit) });
		}
		function useNow() {
		  const [now, setNow] = (0, import_react2.useState)(() => Date.now());
		  (0, import_react2.useEffect)(() => {
		    const timer = setInterval(() => setNow(Date.now()), 6e4);
		    return () => clearInterval(timer);
		  }, []);
		  return now;
		}
		var ITEMS = "[role^=menuitem]";
		function menuKeys(event, close) {
		  if (event.key === "Escape") {
		    event.preventDefault();
		    event.stopPropagation();
		    close();
		    return;
		  }
		  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		  event.preventDefault();
		  event.stopPropagation();
		  const items = [...event.currentTarget.querySelectorAll(ITEMS)].filter((item) => item.closest("[role=menu]") === event.currentTarget);
		  const at = items.indexOf(document.activeElement);
		  items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
		}
		function Menu({ anchor, label, onClose, onKey, children }) {
		  const ref = (0, import_react2.useRef)(null);
		  const [place, setPlace] = (0, import_react2.useState)({ visibility: "hidden" });
		  (0, import_react2.useLayoutEffect)(() => {
		    const box = anchor.getBoundingClientRect();
		    const height = ref.current?.offsetHeight ?? 0;
		    const width = ref.current?.offsetWidth ?? 0;
		    const right = Math.max(8, window.innerWidth - box.right);
		    const fits = box.bottom + 6 + height <= window.innerHeight - 8;
		    setPlace({
		      right: window.innerWidth - right - width < 8 ? window.innerWidth - width - 8 : right,
		      ...fits ? { top: box.bottom + 6 } : { bottom: Math.max(8, window.innerHeight - box.top + 6) }
		    });
		  }, [anchor]);
		  const placed = place.visibility !== "hidden";
		  (0, import_react2.useEffect)(() => {
		    if (placed) ref.current?.querySelector(ITEMS)?.focus({ preventScroll: true });
		  }, [placed]);
		  (0, import_react2.useEffect)(() => {
		    const away = (event) => {
		      const target = event.target;
		      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
		    };
		    const gone = () => onClose();
		    document.addEventListener("pointerdown", away, true);
		    window.addEventListener("resize", gone);
		    return () => {
		      document.removeEventListener("pointerdown", away, true);
		      window.removeEventListener("resize", gone);
		    };
		  }, [anchor, onClose]);
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "div",
		    {
		      ref,
		      className: "bda-menu",
		      role: "menu",
		      "aria-label": label,
		      style: place,
		      onKeyDown: (event) => {
		        if (onKey && !event.metaKey && !event.ctrlKey && !event.altKey && onKey(event.key.toLowerCase())) {
		          event.preventDefault();
		          return;
		        }
		        menuKeys(event, () => {
		          onClose();
		          anchor.focus();
		        });
		      },
		      children
		    }
		  );
		}
		function ChoiceItem({ label, on, count, onPick }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitemradio", "aria-checked": on, onClick: onPick, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: label }),
		    count !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-count", children: count }),
		    on && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-tick", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.tick }) })
		  ] });
		}
		function SubMenu({ id, label, value, open, setOpen, children }) {
		  const isOpen = open === id;
		  const panel = (0, import_react2.useRef)(null);
		  const [flip, setFlip] = (0, import_react2.useState)(false);
		  (0, import_react2.useLayoutEffect)(() => {
		    if (isOpen && panel.current) setFlip(panel.current.getBoundingClientRect().right + (flip ? panel.current.offsetWidth : 0) > window.innerWidth - 8);
		  }, [isOpen]);
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-menu-row", onMouseEnter: () => setOpen(id), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		      "button",
		      {
		        type: "button",
		        className: "bda-menu-item",
		        role: "menuitem",
		        "aria-haspopup": "menu",
		        "aria-expanded": isOpen,
		        onClick: () => setOpen(isOpen ? null : id),
		        onKeyDown: (event) => {
		          if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
		            event.preventDefault();
		            setOpen(id);
		            requestAnimationFrame(() => panel.current?.querySelector(ITEMS)?.focus());
		          }
		        },
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: label }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-value", children: value }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-chev", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.chevron, size: 12 }) })
		        ]
		      }
		    ),
		    isOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      "div",
		      {
		        ref: panel,
		        className: "bda-submenu",
		        role: "menu",
		        "aria-label": label,
		        "data-flip": flip,
		        onKeyDown: (event) => {
		          if (event.key === "ArrowLeft" || event.key === "Escape") {
		            event.preventDefault();
		            event.stopPropagation();
		            setOpen(null);
		            event.currentTarget.previousElementSibling?.focus();
		            return;
		          }
		          menuKeys(event, () => setOpen(null));
		        },
		        children
		      }
		    )
		  ] });
		}
		function FilterMenu({ anchor, filters, setFilters, types, counts, t, onClose }) {
		  const [open, setOpen] = (0, import_react2.useState)(null);
		  const typeLabel = filters.types.length === 0 ? t("filter.any") : filters.types.length === 1 ? t(`type.${filters.types[0]}`) : t("filter.some", { count: String(filters.types.length) });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Menu, { anchor, label: t("filter.button"), onClose, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SubMenu, { id: "sort", label: t("filter.sort"), value: t(`sort.${filters.sort}`), open, setOpen, children: SORTS.map((sort) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChoiceItem, { label: t(`sort.${sort}`), on: filters.sort === sort, onPick: () => setFilters({ ...filters, sort }) }, sort)) }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-menu-rule", role: "separator" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SubMenu, { id: "type", label: t("filter.type"), value: typeLabel, open, setOpen, children: types.map((type) => {
		      const on = filters.types.includes(type);
		      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		        "button",
		        {
		          type: "button",
		          className: "bda-menu-item",
		          role: "menuitemcheckbox",
		          "aria-checked": on,
		          onClick: () => setFilters({ ...filters, types: on ? filters.types.filter((x) => x !== type) : [...filters.types, type] }),
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-check", "data-on": on, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.tick, size: 12 }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t(`type.${type}`) }),
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-count", children: counts.get(type) ?? 0 })
		          ]
		        },
		        type
		      );
		    }) }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SubMenu, { id: "date", label: t("filter.date"), value: t(`date.${filters.date}`), open, setOpen, children: DATES.map((date) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChoiceItem, { label: t(`date.${date}`), on: filters.date === date, onPick: () => setFilters({ ...filters, date }) }, date)) }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SubMenu, { id: "sharing", label: t("filter.sharing"), value: t(`sharing.${filters.sharing}`), open, setOpen, children: SHARINGS.map((sharing) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChoiceItem, { label: t(`sharing.${sharing}`), on: filters.sharing === sharing, onPick: () => setFilters({ ...filters, sharing }) }, sharing)) }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-menu-rule", role: "separator" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { onMouseEnter: () => setOpen(null), children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitemcheckbox", "aria-checked": filters.pinned, onClick: () => setFilters({ ...filters, pinned: !filters.pinned }), children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t("filter.pinned") }),
		        filters.pinned && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-tick", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.tick }) })
		      ] }),
		      isFiltered(filters) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-menu-item", role: "menuitem", onClick: () => setFilters({ ...NO_FILTERS, sort: filters.sort }), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t("filter.clear") }) })
		    ] })
		  ] });
		}
		function ActionsMenu({ anchor, view, t, onClose, act }) {
		  const item = (what, icon, label, key) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitem", "aria-keyshortcuts": key, onClick: () => act(what), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: icon }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: label }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("kbd", { className: "bda-menu-key", children: key })
		  ] });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		    Menu,
		    {
		      anchor,
		      label: t("action.more"),
		      onClose,
		      onKey: (key) => {
		        const what = { p: "pin", r: "rename", c: "copy" }[key];
		        if (what === void 0) return false;
		        act(what);
		        return true;
		      },
		      children: [
		        item("pin", ICON.pin, t(view.pinned ? "action.unpin" : "action.pin"), "P"),
		        item("rename", ICON.rename, t("action.rename"), "R"),
		        item("copy", ICON.link, t("action.copy"), "C"),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-menu-rule", role: "separator" }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitem", "data-danger": "true", onClick: () => act("delete"), children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.trash }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t("action.delete") })
		        ] })
		      ]
		    }
		  );
		}
		function CreateMenu({ anchor, skills, canCreate, t, onClose, create }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Menu, { anchor, label: t("create.new"), onClose, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitem", disabled: !canCreate, onClick: () => create(), children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.chat }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t("create.session") })
		    ] }),
		    skills.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-menu-rule", role: "separator" }),
		    skills.map((skill) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-menu-item", role: "menuitem", "data-skill": skill, onClick: () => create(skill), style: { "--bda-tint": tintOf(skill) }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "color-mix(in srgb,var(--bda-tint) 78%,var(--dsw-alias-label-primary))" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TypeIcon, { skill, size: 16 }) }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-menu-label", children: t(`type.${skill}`) })
		    ] }, skill))
		  ] });
		}
		function Dialog({ label, onClose, children }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "div",
		    {
		      className: "bda-scrim",
		      onPointerDown: (event) => {
		        if (event.target === event.currentTarget) onClose();
		      },
		      onKeyDown: (event) => {
		        if (event.key === "Escape") {
		          event.stopPropagation();
		          onClose();
		        }
		      },
		      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-dialog", role: "dialog", "aria-modal": "true", "aria-label": label, children })
		    }
		  );
		}
		function RenameDialog({ view, t, onClose, onSave }) {
		  const [title, setTitle] = (0, import_react2.useState)(view.title);
		  const input = (0, import_react2.useRef)(null);
		  (0, import_react2.useEffect)(() => {
		    input.current?.focus();
		    input.current?.select();
		  }, []);
		  const clean = title.trim();
		  const ready = clean !== "" && clean !== view.title;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Dialog, { label: t("rename.title"), onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		    "form",
		    {
		      onSubmit: (event) => {
		        event.preventDefault();
		        if (ready) onSave(clean);
		      },
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("rename.title") }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { ref: input, value: title, "aria-label": t("rename.title"), maxLength: 200, onChange: (event) => setTitle(event.target.value) }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-dialog-actions", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-btn", onClick: onClose, children: t("dialog.cancel") }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", className: "bda-btn", "data-primary": "true", disabled: !ready, children: t("rename.save") })
		        ] })
		      ]
		    }
		  ) });
		}
		function DeleteDialog({ view, t, onClose, onDelete }) {
		  const confirm = (0, import_react2.useRef)(null);
		  (0, import_react2.useEffect)(() => confirm.current?.focus(), []);
		  const title = t("delete.title", { title: view.title });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Dialog, { label: title, onClose, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: title }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: view.deletable ? t("delete.moves") : t("delete.keeps", { path: view.root }) }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-dialog-actions", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-btn", onClick: onClose, children: t("dialog.cancel") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { ref: confirm, type: "button", className: "bda-btn", "data-danger": "true", onClick: onDelete, children: t("delete.confirm") })
		    ] })
		  ] });
		}
		function ToastBar({ toast, t, onClose, onUndo }) {
		  (0, import_react2.useEffect)(() => {
		    const timer = setTimeout(onClose, toast.undo || toast.kind === "error" ? 1e4 : 4e3);
		    return () => clearTimeout(timer);
		  }, [toast, onClose]);
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-toast", role: toast.kind === "error" ? "alert" : "status", "data-kind": toast.kind, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.info }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-toast-text", children: toast.message }),
		    toast.undo && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-toast-undo", onClick: () => onUndo(toast.undo), children: t("toast.undo") }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-toast-close", "aria-label": t("toast.close"), onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.clear, size: 14 }) })
		  ] });
		}
		var hint = (view, conversation) => conversation ? `${view.root}
		${conversation}` : view.root;
		function PinButton({ view, t, onPin }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-act", "data-on": view.pinned, "aria-pressed": view.pinned, "aria-label": t(view.pinned ? "action.unpin" : "action.pin"), title: t(view.pinned ? "action.unpin" : "action.pin"), onClick: () => onPin(view), children: view.pinned ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", style: svg(16), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9.75 2.25 13.75 6.25M10.75 3.25 7 6.25 4.5 6.5 9.5 11.5 9.75 9 12.75 5.25M7 9l-4 4", fill: "currentColor", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.pin }) });
		}
		function MoreButton({ view, t, menuOpen, onMenu, extra }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: `bda-act ${extra ?? ""}`, "aria-label": t("action.more"), title: t("action.more"), "aria-haspopup": "menu", "aria-expanded": menuOpen, onClick: (event) => onMenu(view, event.currentTarget), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.more }) });
		}
		function Card({ view, state, conversation, now, t, thumbnailUrl, onOpen, onPin, menuOpen, onMenu }) {
		  const opening = state.opening === view.root;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "bda-item", "data-menu": menuOpen, style: { "--bda-tint": tintOf(view.skill) }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-card", disabled: state.opening !== null, "aria-busy": opening, title: hint(view, conversation), onClick: () => onOpen(view), "data-skill": view.skill, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bda-preview-wrap", style: { display: "block", position: "relative", width: "100%" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Preview, { view, thumbnailUrl }),
		        opening && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bda-busy", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-spinner" }),
		          t("card.opening")
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bda-info", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-glyph", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TypeIcon, { skill: view.skill }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bda-text", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-name", children: view.title }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-meta", children: ago(view.openedAt, now, t) })
		        ] })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-actions", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MoreButton, { view, t, menuOpen, onMenu }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PinButton, { view, t, onPin })
		    ] })
		  ] });
		}
		function Row({ view, state, conversation, now, t, onOpen, onPin, menuOpen, onMenu }) {
		  const opening = state.opening === view.root;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "bda-item", "data-menu": menuOpen, style: { "--bda-tint": tintOf(view.skill) }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-row", disabled: state.opening !== null, "aria-busy": opening, title: hint(view, conversation), onClick: () => onOpen(view), "data-skill": view.skill, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-glyph", children: opening ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-spinner" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TypeIcon, { skill: view.skill }) }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-name", children: view.title }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-meta", children: opening ? t("card.opening") : ago(view.openedAt, now, t) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-row-tools", children: [
		      view.shared && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-shared", title: t("card.shared"), "aria-label": t("card.shared"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.people }) }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PinButton, { view, t, onPin }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MoreButton, { view, t, menuOpen, onMenu, extra: "bda-act-more" })
		    ] })
		  ] });
		}
		function readView() {
		  try {
		    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
		  } catch {
		    return "grid";
		  }
		}
		function writeView(view) {
		  try {
		    localStorage.setItem(VIEW_KEY, view);
		  } catch {
		  }
		}
		function ArtifactsPage(props) {
		  const { t, updates, artifactsStore, sessionsStore, reloadArtifacts, openArtifact, create, canCreate, createOptions, pin, rename, copyLink, remove, undo, thumbnailUrl, watchThumbnails, dismissToast } = props;
		  const state = (0, import_react2.useSyncExternalStore)(artifactsStore.subscribe, artifactsStore.getSnapshot);
		  const sessions = (0, import_react2.useSyncExternalStore)(sessionsStore.subscribe, sessionsStore.getSnapshot);
		  const [query, setQuery] = (0, import_react2.useState)("");
		  const [searching, setSearching] = (0, import_react2.useState)(false);
		  const [filters, setFilters] = (0, import_react2.useState)(NO_FILTERS);
		  const [layout, setLayout] = (0, import_react2.useState)(readView);
		  const [popup, setPopup] = (0, import_react2.useState)(null);
		  const [dialog, setDialog] = (0, import_react2.useState)(null);
		  const searchBox = (0, import_react2.useRef)(null);
		  const now = useNow();
		  (0, import_react2.useEffect)(() => {
		    reloadArtifacts();
		    const again = () => {
		      if (document.visibilityState === "visible") reloadArtifacts();
		    };
		    document.addEventListener("visibilitychange", again);
		    return () => document.removeEventListener("visibilitychange", again);
		  }, [reloadArtifacts]);
		  (0, import_react2.useEffect)(() => watchThumbnails(), [watchThumbnails]);
		  (0, import_react2.useEffect)(() => {
		    if (searching) searchBox.current?.focus();
		  }, [searching]);
		  const counts = (0, import_react2.useMemo)(() => {
		    const by = /* @__PURE__ */ new Map();
		    for (const a of state.artifacts) by.set(a.skill, (by.get(a.skill) ?? 0) + 1);
		    return by;
		  }, [state.artifacts]);
		  const types = (0, import_react2.useMemo)(() => SKILLS.filter((s) => state.skills.includes(s) || counts.has(s)), [state.skills, counts]);
		  const tiles = (0, import_react2.useMemo)(() => createOptions(), [state.skills, createOptions]);
		  const shown = (0, import_react2.useMemo)(() => {
		    const q = query.trim().toLowerCase();
		    const kept = state.artifacts.filter((a) => {
		      if (filters.types.length > 0 && !filters.types.includes(a.skill)) return false;
		      if (filters.pinned && !a.pinned) return false;
		      if (filters.sharing !== "any" && a.shared !== (filters.sharing === "shared")) return false;
		      if (!inRange(a.openedAt, filters.date, now)) return false;
		      if (!q) return true;
		      const conversation = sessions.byId?.[a.sessionId]?.title ?? "";
		      return a.title.toLowerCase().includes(q) || conversation.toLowerCase().includes(q) || a.root.toLowerCase().includes(q);
		    });
		    return sorted(kept, filters.sort, t("time.locale"));
		  }, [state.artifacts, filters, query, sessions, now, t]);
		  const closePopup = (0, import_react2.useMemo)(() => () => setPopup(null), []);
		  const actionsFor = popup?.kind === "actions" ? state.artifacts.find((a) => a.root === popup.root) : void 0;
		  const dialogFor = dialog ? state.artifacts.find((a) => a.root === dialog.root) : void 0;
		  const itemProps = (view) => ({
		    view,
		    state,
		    conversation: sessions.byId?.[view.sessionId]?.title?.trim() ?? "",
		    now,
		    t,
		    thumbnailUrl,
		    onOpen: openArtifact,
		    onPin: (v) => pin(v, !v.pinned),
		    menuOpen: popup?.kind === "actions" && popup.root === view.root,
		    onMenu: (v, anchor) => setPopup((p) => p?.kind === "actions" && p.root === v.root ? null : { kind: "actions", anchor, root: v.root })
		  });
		  const toggle = (kind, anchor) => setPopup((p) => p?.kind === kind ? null : { kind, anchor });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "bda-page", "aria-label": t("title"), "data-testid": "baoyu-design-artifacts", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-content", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-heading", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { children: t("title") }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-tools", children: [
		          searching || query ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "bda-search", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.search, size: 14 }),
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		              "input",
		              {
		                ref: searchBox,
		                type: "search",
		                value: query,
		                placeholder: t("search"),
		                "aria-label": t("search"),
		                onChange: (e) => setQuery(e.target.value),
		                onBlur: () => {
		                  if (!query) setSearching(false);
		                },
		                onKeyDown: (e) => {
		                  if (e.key === "Escape") {
		                    setQuery("");
		                    setSearching(false);
		                  }
		                }
		              }
		            ),
		            query && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		              "button",
		              {
		                type: "button",
		                "aria-label": t("search.clear"),
		                onClick: () => {
		                  setQuery("");
		                  searchBox.current?.focus();
		                },
		                children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.clear, size: 12 })
		              }
		            )
		          ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-tool", "aria-label": t("search"), title: t("search"), onClick: () => setSearching(true), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.search, size: 18 }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-tool", "aria-label": t("filter.button"), title: t("filter.button"), "aria-haspopup": "menu", "aria-expanded": popup?.kind === "filter", "data-active": isFiltered(filters), onClick: (e) => toggle("filter", e.currentTarget), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.filter, size: 18 }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		            "button",
		            {
		              type: "button",
		              className: "bda-tool",
		              "aria-label": t(layout === "grid" ? "view.list" : "view.grid"),
		              title: t(layout === "grid" ? "view.list" : "view.grid"),
		              onClick: () => {
		                const next = layout === "grid" ? "list" : "grid";
		                setLayout(next);
		                writeView(next);
		              },
		              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: layout === "grid" ? ICON.list : ICON.grid, size: 18 })
		            }
		          ),
		          canCreate() && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-tool", "aria-label": t("create.new"), title: t("create.new"), "aria-haspopup": "menu", "aria-expanded": popup?.kind === "create", onClick: (e) => toggle("create", e.currentTarget), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { d: ICON.plus, size: 18 }) })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UpdateBar, { updates }),
		      tiles.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "bda-section-title", children: t("create.heading") }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "bda-tiles", children: tiles.map((skill) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bda-tile", "data-skill": skill, style: { "--bda-tint": tintOf(skill) }, onClick: () => create(skill), children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bda-tile-art", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { className: "bda-tile-squiggle", viewBox: "0 0 140 100", preserveAspectRatio: "xMidYMid slice", fill: "none", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "0 3.2", strokeLinecap: "round", "aria-hidden": "true", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 84C20 16 42 98 62 42s38 58 74-28" }),
		              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M6 88C24 22 44 104 66 46s36 56 72-26" }),
		              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2 80C18 12 40 92 58 38s40 58 76-28" })
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TypeIcon, { skill, size: 40 })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bda-tile-label", children: t(`type.${skill}`) })
		        ] }) }, skill)) })
		      ] }),
		      state.status === "loading" && state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "bda-grid bda-skeleton", "aria-hidden": "true", children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { className: "bda-item", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-card", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-preview" }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bda-line" })
		      ] }) }, i)) }) : state.status === "error" && state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-empty", role: "alert", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("load.error", { message: state.error }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-retry", onClick: reloadArtifacts, children: t("load.retry") })
		      ] }) : state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-empty", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ArtifactsIcon, { size: 28 }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("empty.title") }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("empty.body") })
		      ] }) : shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bda-empty", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("empty.noMatches") }),
		        isFiltered(filters) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bda-retry", onClick: () => setFilters({ ...NO_FILTERS, sort: filters.sort }), children: t("filter.clear") })
		      ] }) : layout === "grid" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "bda-grid", children: shown.map((view) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Card, { ...itemProps(view) }, view.root)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "bda-list", children: shown.map((view) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { ...itemProps(view) }, view.root)) })
		    ] }) }),
		    popup?.kind === "filter" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FilterMenu, { anchor: popup.anchor, filters, setFilters, types, counts, t, onClose: closePopup }),
		    popup?.kind === "create" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      CreateMenu,
		      {
		        anchor: popup.anchor,
		        skills: tiles,
		        canCreate: canCreate(),
		        t,
		        onClose: closePopup,
		        create: (skill) => {
		          setPopup(null);
		          create(skill);
		        }
		      }
		    ),
		    popup?.kind === "actions" && actionsFor && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      ActionsMenu,
		      {
		        anchor: popup.anchor,
		        view: actionsFor,
		        t,
		        onClose: closePopup,
		        act: (what) => {
		          setPopup(null);
		          if (what === "pin") pin(actionsFor, !actionsFor.pinned);
		          else if (what === "copy") copyLink(actionsFor);
		          else setDialog({ kind: what, root: actionsFor.root });
		        }
		      }
		    ),
		    dialog?.kind === "rename" && dialogFor && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      RenameDialog,
		      {
		        view: dialogFor,
		        t,
		        onClose: () => setDialog(null),
		        onSave: (title) => {
		          setDialog(null);
		          rename(dialogFor, title);
		        }
		      }
		    ),
		    dialog?.kind === "delete" && dialogFor && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      DeleteDialog,
		      {
		        view: dialogFor,
		        t,
		        onClose: () => setDialog(null),
		        onDelete: () => {
		          setDialog(null);
		          remove(dialogFor);
		        }
		      }
		    ),
		    state.toast && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ToastBar, { toast: state.toast, t, onClose: dismissToast, onUndo: undo }, state.toast.id)
		  ] });
		}
		var SIDEBAR_WAIT_MS = 5e3;
		async function openInSidebar(sidebar, sessionId, url) {
		  if (typeof sidebar.tabsIn !== "function") {
		    sidebar.openTabIn(sessionId, "browser", { params: { url } });
		    return true;
		  }
		  const browsers = () => sidebar.tabsIn(sessionId).filter((tab) => tab.kind === "browser").length;
		  const deadline = Date.now() + SIDEBAR_WAIT_MS;
		  for (; ; ) {
		    const before = browsers();
		    sidebar.openTabIn(sessionId, "browser", { params: { url } });
		    if (browsers() > before) return true;
		    if (Date.now() >= deadline) return false;
		    await new Promise((resolve) => setTimeout(resolve, 100));
		  }
		}
		var route2 = (path) => path.slice(1);
		function mountPage(ctx) {
		  const disposers = [];
		  const style = typeof document === "undefined" ? null : document.createElement("style");
		  if (style) {
		    style.dataset.pluginCss = "baoyu-design/artifacts-page.css";
		    style.textContent = CSS2;
		    document.head.appendChild(style);
		    disposers.push(() => style.remove());
		  }
		  disposers.push(ctx.locale.register(NS2, { zh: zh2, en: en2 }));
		  const t = ctx.locale.bind?.(NS2) ?? ((key) => en2[key] ?? key);
		  const store = createStore({ status: "loading", artifacts: [], error: "", skills: [], opening: null, toast: null });
		  const updates = pageUpdates(ctx);
		  let places = /* @__PURE__ */ new Map();
		  let defaultPreset;
		  let toastId = 0;
		  const toast = (message, kind = "info", undo2) => store.set({ toast: { id: ++toastId, message, kind, ...undo2 ? { undo: undo2 } : {} } });
		  const failed = (error) => toast(t("action.failed", { message: error.message }), "error");
		  const patchView = (root, patch) => store.set({ artifacts: store.getSnapshot().artifacts.map((a) => a.root === root ? { ...a, ...patch } : a) });
		  const call = async (path, params, init = { method: "POST" }) => {
		    const response = await fetch(`${route2(path)}?${new URLSearchParams(params)}`, init);
		    const body = await response.json().catch(() => ({}));
		    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
		    return body;
		  };
		  const ownPluginThere = (view) => {
		    if (view.openable) return true;
		    toast(t("open.pluginOff", { plugin: view.plugin }), "error");
		    return false;
		  };
		  let pump = () => {
		  };
		  let loading = null;
		  const reload = () => {
		    if (loading) return;
		    if (store.getSnapshot().artifacts.length === 0) store.set({ status: "loading" });
		    loading = (async () => {
		      try {
		        const response = await fetch(route2(listPath), { cache: "no-store" });
		        if (!response.ok) throw new Error(`HTTP ${response.status}`);
		        const body = await response.json();
		        const artifacts = Array.isArray(body.artifacts) ? body.artifacts.filter((a) => a && typeof a.root === "string") : [];
		        const usable = (Array.isArray(body.skills) ? body.skills : []).filter((s) => s.everywhere || s.presets.length > 0);
		        places = new Map(usable.map((s) => [s.skill, s]));
		        defaultPreset = typeof body.defaultPreset === "string" ? body.defaultPreset : void 0;
		        store.set({ status: "ready", artifacts, skills: [...places.keys()], error: "" });
		        pump();
		      } catch (error) {
		        store.set({ status: "error", error: error.message });
		      }
		    })().finally(() => {
		      loading = null;
		    });
		  };
		  const open = (view) => {
		    if (store.getSnapshot().opening !== null) return;
		    if (!ownPluginThere(view)) return;
		    store.set({ opening: view.root, toast: null });
		    void (async () => {
		      try {
		        const response = await fetch(`${route2(openPath)}?${new URLSearchParams({ root: view.root })}`, { method: "POST" });
		        const body = await response.json().catch(() => ({}));
		        if (!response.ok || typeof body.url !== "string") throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
		        const url = body.url;
		        const sessionId = typeof body.sessionId === "string" ? body.sessionId : view.sessionId;
		        const sessions = ctx.get("sessions");
		        const workspaces = ctx.get("workspaces");
		        const workspace = ctx.get("uiWorkspace");
		        const sidebar = ctx.get("sidebarRight");
		        const tabs = ctx.get("sidebarRightTabs");
		        const reachable = workspace !== void 0 && linkState(sessionId, sessions?.list?.getSnapshot(), workspaces?.list?.getSnapshot()) === "available";
		        if (reachable) {
		          workspace.openSession(sessionId);
		          const shown = sidebar !== void 0 && tabs?.get("browser") !== void 0 && await openInSidebar(sidebar, sessionId, url);
		          if (!shown) window.open(url, "_blank", "noopener,noreferrer");
		          store.set({ opening: null });
		        } else {
		          window.open(url, "_blank", "noopener,noreferrer");
		          store.set({ opening: null });
		          toast(t("open.noSession"));
		        }
		        reload();
		      } catch (error) {
		        store.set({ opening: null });
		        toast(t("open.failed", { message: error.message }), "error");
		      }
		    })();
		  };
		  const workspaceNav = () => ctx.get("uiWorkspace");
		  const canCreate = () => typeof workspaceNav()?.startSession === "function";
		  const createOptions = () => canCreate() ? creatable(store.getSnapshot().skills) : [];
		  const create = (skill) => {
		    const nav = workspaceNav();
		    if (typeof nav?.startSession !== "function") return;
		    if (skill === void 0 || !isSkill(skill)) return nav.startSession();
		    const place = places.get(skill);
		    const agentPreset = place !== void 0 && !place.everywhere && !(defaultPreset !== void 0 && place.presets.includes(defaultPreset)) ? place.presets[0] : void 0;
		    nav.startSession(void 0, { prompt: promptFor(skill, t), whenDraftExists: "append", ...agentPreset === void 0 ? {} : { agentPreset } });
		  };
		  const pin = (view, pinned) => {
		    if (!ownPluginThere(view)) return;
		    patchView(view.root, { pinned });
		    call(updatePath, { root: view.root }, { method: "POST", body: JSON.stringify({ pinned }) }).catch((error) => {
		      patchView(view.root, { pinned: view.pinned });
		      failed(error);
		    });
		  };
		  const rename = (view, title) => {
		    if (!ownPluginThere(view)) return;
		    patchView(view.root, { title });
		    call(updatePath, { root: view.root }, { method: "POST", body: JSON.stringify({ title }) }).then(reload, (error) => {
		      patchView(view.root, { title: view.title });
		      failed(error);
		    });
		  };
		  const copyText = async (text) => {
		    try {
		      await navigator.clipboard.writeText(text);
		    } catch {
		      const area = document.createElement("textarea");
		      area.value = text;
		      area.style.cssText = "position:fixed;opacity:0";
		      document.body.append(area);
		      area.select();
		      const done = document.execCommand("copy");
		      area.remove();
		      if (!done) throw new Error("the clipboard refused it");
		    }
		  };
		  const copyLink = (view) => {
		    if (!ownPluginThere(view)) return;
		    void (async () => {
		      try {
		        const { url } = await call(previewPath, { root: view.root });
		        await call(releasePath, { root: view.root, keep: "1" });
		        if (typeof url !== "string") throw new Error("no address");
		        await copyText(url);
		        toast(t("toast.copied"));
		      } catch (error) {
		        failed(error);
		      }
		    })();
		  };
		  const remove = (view) => {
		    if (!ownPluginThere(view)) return;
		    void (async () => {
		      try {
		        const { trash, moved } = await call(deletePath, { root: view.root });
		        store.set({ artifacts: store.getSnapshot().artifacts.filter((a) => a.root !== view.root) });
		        toast(t(moved === true ? "toast.deleted" : "toast.removed", { title: view.title }), "info", String(trash));
		      } catch (error) {
		        failed(error);
		      }
		    })();
		  };
		  const undo = (id) => {
		    store.set({ toast: null });
		    call(restorePath, { trash: id }).then(reload, failed);
		  };
		  const thumbnailUrl = (view) => view.thumbnail === null ? null : `${route2(thumbnailPath)}?${new URLSearchParams({ root: view.root, v: view.thumbnail })}`;
		  const browser = desktopBrowser();
		  const tried = /* @__PURE__ */ new Set();
		  let watching = null;
		  let taking = false;
		  const takeOne = async (view, signal) => {
		    const { url } = await call(previewPath, { root: view.root });
		    if (typeof url !== "string") throw new Error("no address");
		    try {
		      const bytes = await captureThumbnail(browser, url, view.skill, signal);
		      const saved = await call(thumbnailPath, { root: view.root }, { method: "POST", headers: { "content-type": "image/jpeg" }, body: new Uint8Array(bytes) });
		      if (typeof saved.thumbnail === "string") patchView(view.root, { thumbnail: saved.thumbnail, updatedAt: saved.thumbnail });
		    } finally {
		      await call(releasePath, { root: view.root }).catch(() => null);
		    }
		  };
		  pump = () => {
		    if (taking || watching === null || browser === void 0) return;
		    const signal = watching.signal;
		    taking = true;
		    void (async () => {
		      try {
		        for (; ; ) {
		          if (signal.aborted) return;
		          if (document.visibilityState !== "visible") return;
		          const next = store.getSnapshot().artifacts.find((a) => a.thumbnail !== a.updatedAt && a.openable && !tried.has(`${a.root}\0${a.updatedAt}`));
		          if (next === void 0) return;
		          tried.add(`${next.root}\0${next.updatedAt}`);
		          try {
		            await takeOne(next, signal);
		          } catch (error) {
		            if (!signal.aborted) console.warn(`baoyu-design Artifacts page: no thumbnail for ${next.root}:`, error);
		          }
		        }
		      } finally {
		        taking = false;
		      }
		    })();
		  };
		  const watchThumbnails = () => {
		    const controller = new AbortController();
		    watching = controller;
		    pump();
		    return () => {
		      controller.abort(new Error("the page closed"));
		      if (watching === controller) watching = null;
		    };
		  };
		  disposers.push(() => watching?.abort(new Error("the plugin stopped")));
		  const sessionsStore = () => {
		    const list = ctx.get("sessions")?.list;
		    return isStore(list) ? list : EMPTY_SESSIONS;
		  };
		  disposers.push(toDisposer(ctx.slots.inject(
		    "main",
		    () => ctx.slots.register(
		      {
		        name: "main",
		        key: PANEL_ID,
		        locale: NS2,
		        inject: () => ({
		          updates,
		          artifactsStore: store,
		          sessionsStore: sessionsStore(),
		          reloadArtifacts: reload,
		          openArtifact: open,
		          create,
		          canCreate,
		          createOptions,
		          pin,
		          rename,
		          copyLink,
		          remove,
		          undo,
		          thumbnailUrl,
		          watchThumbnails,
		          dismissToast: () => store.set({ toast: null })
		        })
		      },
		      ArtifactsPage
		    )
		  )));
		  disposers.push(toDisposer(ctx.slots.inject(
		    "sidebar.panellist",
		    () => ctx.slots.register(
		      { name: "sidebar.panellist", id: PANEL_ID, order: 20, locale: NS2, label: () => t("panel") },
		      ArtifactsIcon
		    )
		  )));
		  return () => {
		    for (const dispose of disposers.splice(0).reverse()) {
		      try {
		        dispose();
		      } catch (error) {
		        console.error("baoyu-design Artifacts page: unregistering failed:", error);
		      }
		    }
		  };
		}
		function toDisposer(value) {
		  return typeof value === "function" ? value : () => {
		  };
		}
		function drawsOwnCards(plugin, self) {
		  return plugin !== self && hub2().members.has(plugin);
		}
		function joinArtifactsPage(ctx, plugin) {
		  const h = hub2();
		  h.members.set(plugin, { plugin, skill: "", version: PAGE_VERSION, mount: () => mountPage(ctx) });
		  settle(h);
		  changed(h);
		  ctx.effect(() => () => {
		    h.members.delete(plugin);
		    if (h.owner?.plugin === plugin) {
		      const old = h.owner;
		      h.owner = null;
		      old.dispose();
		    }
		    settle(h);
		    changed(h);
		  }, `${plugin}: Artifacts page`);
		}

		var import_jsx_runtime3 = require("react/jsx-runtime");
		var PLUGIN = "dsh-claude-artifacts";
		var COMMENT_SOURCE = "baoyu-design-comment";
		var KIND = `${PLUGIN}:comment`;
		var NS3 = PLUGIN;
		var SIMPLE_CARD = "dsh-claude-docs";
		var zh3 = {
		  "card.title": "已将对“{title}”的评论发给 Agent",
		  "card.request": "已将“{title}”上的 {label} 发给 Agent",
		  "card.view": "查看评论",
		  "card.more": "显示位置",
		  "card.less": "收起位置"
		};
		var en3 = {
		  "card.title": "Comment on “{title}” sent to agent",
		  "card.request": "{label} on “{title}” sent to agent",
		  "card.view": "View thread",
		  "card.more": "Show where",
		  "card.less": "Hide where"
		};
		var str = (value) => typeof value === "string" ? value : "";
		function ours(event) {
		  if (event.type !== "user/message" || event.surfaceOp !== "append") return false;
		  const source = event.data?.source;
		  return source?.kind === COMMENT_SOURCE && !drawsOwnCards(str(source.plugin), PLUGIN);
		}
		function cardData(event) {
		  const source = event.data?.source ?? {};
		  const threads = Array.isArray(source.threads) ? source.threads : [];
		  const requests = Array.isArray(source.requests) ? source.requests : [];
		  return {
		    simple: str(source.plugin) === SIMPLE_CARD,
		    title: str(source.title),
		    url: str(source.url),
		    threads: threads.map((t) => ({ id: str(t.id), where: str(t.where), text: str(t.text) })).filter((t) => t.id),
		    requests: requests.map((r) => ({ id: str(r.id), label: str(r.label), text: str(r.text) })).filter((r) => r.id && r.text),
		    seq: event.seq
		  };
		}
		var definition = {
		  kind: KIND,
		  target: "chat",
		  match: (event) => (
		    // Claimed: the built-in input-message Definition would draw it as a context row.
		    ours(event) ? { id: String(event.data?.id), role: "start", exclusive: true } : null
		  ),
		  start: (_context, match) => cardData(match.event),
		  update: (context) => context.state,
		  buildViewNode: (context) => {
		    if (context.state === void 0) return null;
		    return {
		      key: context.key,
		      kind: KIND,
		      id: context.id,
		      target: "chat",
		      anchorSeq: context.state.seq,
		      location: context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" },
		      visibility: "visible",
		      // A person's input, as a user message: it opens the agent's reply below it.
		      groupTree: "input",
		      data: context.state
		    };
		  }
		};
		var CSS3 = `
		.bdc-row{display:flex;flex-direction:column;align-items:flex-end;gap:8px;width:100%}
		.bdc-card{box-sizing:border-box;max-width:min(calc(var(--dsh-chat-content-width, 748px) * 0.702), 82%);min-width:min(320px, 82%);
		  border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-xl, 12px);background:var(--dsw-alias-markdown-code-block);
		  color:var(--dsw-alias-label-primary);padding:10px 14px 12px;display:flex;flex-direction:column;gap:6px}
		.bdc-head{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12, 12px/18px sans-serif)}
		.bdc-head svg{flex:none}
		.bdc-head-text{flex:1;min-width:0;display:flex;white-space:nowrap;overflow:hidden}
		.bdc-head-text>span{flex:none}
		.bdc-head-text>.bdc-head-title{flex:0 1 auto;min-width:1.5em;overflow:hidden;text-overflow:ellipsis}
		.bdc-toggle{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin:-2px -4px -2px 0;
		  border:0;border-radius:var(--dsw-radius-sm, 6px);background:none;color:inherit;cursor:pointer;padding:0}
		.bdc-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
		.bdc-toggle svg{transition:transform .15s}
		.bdc-toggle[aria-expanded=false] svg{transform:rotate(-90deg)}
		.bdc-body{font-size:var(--dsh-content-font-size, 14px);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
		.bdc-meta{display:flex;flex-direction:column;gap:6px;padding-top:6px;border-top:0.5px solid var(--dsw-alias-border-l1)}
		.bdc-where{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12, 12px/18px sans-serif);overflow-wrap:anywhere}
		.bdc-view{align-self:flex-start;display:inline-flex;align-items:center;gap:2px;height:24px;margin-left:-6px;padding:0 6px;border:0;
		  border-radius:var(--dsw-radius-sm, 6px);background:none;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12, 12px/18px sans-serif);cursor:pointer}
		.bdc-view:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
		.bdc-view:focus-visible,.bdc-toggle:focus-visible{outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:1px}
		@media (prefers-reduced-motion:reduce){.bdc-toggle svg{transition:none}}
		`;
		var iconStyle = { display: "block" };
		var TITLE_MARK = "";
		function CommentIcon() {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		    "path",
		    {
		      d: "M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.2L5.4 13.8a.3.3 0 0 1-.5-.23V11.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z",
		      stroke: "currentColor",
		      strokeWidth: "1.2",
		      strokeLinejoin: "round"
		    }
		  ) });
		}
		function RequestIcon() {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: iconStyle, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: "2", y: "4", width: "12", height: "7", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8.5 8.5 11 14l.9-2.1L14 11l-5.5-2.5Z", fill: "currentColor", stroke: "var(--dsw-alias-markdown-code-block, #fff)", strokeWidth: "0.8", strokeLinejoin: "round" })
		  ] });
		}
		function ChevronDown() {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M3 4.5 6 7.5l3-3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function ChevronRight() {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4.5 3 7.5 6l-3 3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function Card2({ simple, title, thread, url, t, openThread }) {
		  const [open, setOpen] = (0, import_react3.useState)(true);
		  const heading = t("card.title", { title });
		  const meta = !simple && (thread.where || url);
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-card", "data-comment-id": thread.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CommentIcon, {}),
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Heading, { text: heading, title, parts: t("card.title", { title: TITLE_MARK }).split(TITLE_MARK) }),
		      meta && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "bdc-toggle", "aria-expanded": open, "aria-label": t(open ? "card.less" : "card.more"), onClick: () => setOpen(!open), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown, {}) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "bdc-body", children: thread.text }),
		    meta && open && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-meta", children: [
		      thread.where && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "bdc-where", children: thread.where }),
		      url && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "bdc-view", onClick: () => openThread(url, thread.id), children: [
		        t("card.view"),
		        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronRight, {})
		      ] })
		    ] })
		  ] });
		}
		function Heading({ text, title, parts }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bdc-head-text", title: text, children: parts.length === 2 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: parts[0] }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bdc-head-title", children: title }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: parts[1] })
		  ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bdc-head-title", children: text }) });
		}
		function RequestCardView({ title, request, t }) {
		  const label = request.label || "Request";
		  const heading = t("card.request", { title, label });
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-card", "data-request-id": request.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RequestIcon, {}),
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Heading, { text: heading, title, parts: t("card.request", { title: TITLE_MARK, label }).split(TITLE_MARK) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "bdc-body", children: request.text })
		  ] });
		}
		function CommentCards({ node, t, openThread }) {
		  const { simple, title, url, threads, requests } = node.data;
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bdc-row", children: [
		    threads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Card2, { simple: simple === true, title, thread, url, t, openThread }, thread.id)),
		    (requests ?? []).map((request) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RequestCardView, { title, request, t }, request.id))
		  ] });
		}
		var inject = ["slots", "locale", "uiConversation"];
		function threadUrl(url, id) {
		  try {
		    const at = new URL(url);
		    at.searchParams.set("comment", id);
		    return at.href;
		  } catch {
		    return url;
		  }
		}
		function apply(ctx) {
		  ctx.effect(() => {
		    if (typeof document === "undefined") return () => {
		    };
		    const id = `${PLUGIN}/comment-card.css`;
		    if (document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`)) return () => {
		    };
		    const tag = document.createElement("style");
		    tag.dataset.plugin = PLUGIN;
		    tag.dataset.pluginCss = id;
		    tag.textContent = CSS3;
		    document.head.appendChild(tag);
		    return () => tag.remove();
		  }, `${PLUGIN}: comment card styles`);
		  ctx.effect(() => ctx.locale.register(NS3, { zh: zh3, en: en3 }), `${PLUGIN}: dictionaries`);
		  ctx.uiConversation.events.register(definition);
		  ctx.slots.inject(
		    "conversation.chat.node",
		    () => ctx.slots.register(
		      {
		        name: "conversation.chat.node",
		        key: KIND,
		        locale: NS3,
		        inject: (sessionId) => ({
		          openThread: (url, threadId) => {
		            const target = threadUrl(url, threadId);
		            const sidebar = ctx.get("sidebarRight");
		            const tabs = ctx.get("sidebarRightTabs");
		            if (sidebar && tabs?.get("browser") !== void 0) sidebar.openTabIn(sessionId, "browser", { params: { url: target } });
		            else window.open(target, "_blank", "noopener,noreferrer");
		          }
		        })
		      },
		      CommentCards
		    )
		  );
		  joinArtifactsPage(ctx, PLUGIN);
		  joinUpdates(ctx, PLUGIN);
		}
		return module.exports;
	}
});
