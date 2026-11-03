// dsh-claude-design 2.8.0: built from baoyu-design.
window.__ModuleLoader__.load({
	id: "dsh-claude-design",
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

		var define_CLIENT_default = { plugin: "dsh-claude-design", skill: "claude-design", key: "dsh-claude-design", simple: false };

		var import_react2 = require("react");

		var import_react = require("react");

		var listPath = (skill) => `/api/baoyu-design.${skill}.artifacts`;
		var openPath = (skill) => `/api/baoyu-design.${skill}.artifacts.open`;

		var import_jsx_runtime = require("react/jsx-runtime");
		var PAGE_VERSION = 1;
		var PANEL_ID = "baoyu-design.artifacts";
		var NS = "baoyu-design-artifacts";
		var HUB = Symbol.for("baoyu-design/dsh-artifacts-page");
		function hub() {
		  const g = globalThis;
		  return g[HUB] ??= { members: /* @__PURE__ */ new Map(), owner: null, listeners: /* @__PURE__ */ new Set() };
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
		var zh = {
		  panel: "作品",
		  title: "作品",
		  "time.locale": "zh-CN",
		  search: "搜索作品",
		  "search.clear": "清除搜索",
		  "filter.all": "全部",
		  "type.claude-slides": "幻灯片",
		  "type.claude-design": "设计",
		  "type.claude-design-system": "设计系统",
		  "type.claude-dashboard": "仪表盘",
		  "type.claude-docs": "文档",
		  "type.claude-motion": "动画",
		  "card.opened": "{time}打开",
		  "card.justNow": "刚刚打开",
		  "card.opening": "正在打开…",
		  "card.in": "在“{title}”中",
		  "empty.title": "还没有作品",
		  "empty.body": "Agent 用 baoyu-design 的技能打开幻灯片、设计稿、设计系统、仪表盘、文档或动画以后，会出现在这里。",
		  "empty.noMatches": "没有符合条件的作品",
		  "load.error": "读取作品列表失败：{message}",
		  "load.retry": "重试",
		  "open.pluginOff": "{plugin} 插件没有开启，打不开这个作品。",
		  "open.failed": "打不开：{message}",
		  "open.noSession": "原来的对话已不在，编辑器在新窗口里打开了。"
		};
		var en = {
		  panel: "Artifacts",
		  title: "Artifacts",
		  "time.locale": "en",
		  search: "Search artifacts",
		  "search.clear": "Clear search",
		  "filter.all": "All",
		  "type.claude-slides": "Slides",
		  "type.claude-design": "Design",
		  "type.claude-design-system": "Design systems",
		  "type.claude-dashboard": "Dashboards",
		  "type.claude-docs": "Docs",
		  "type.claude-motion": "Motion",
		  "card.opened": "Opened {time}",
		  "card.justNow": "Opened just now",
		  "card.opening": "Opening…",
		  "card.in": "In “{title}”",
		  "empty.title": "No artifacts yet",
		  "empty.body": "Slide decks, canvases, design systems, dashboards, docs and films the agent opens with a baoyu-design skill show up here.",
		  "empty.noMatches": "No artifacts match",
		  "load.error": "Could not read the artifacts: {message}",
		  "load.retry": "Try again",
		  "open.pluginOff": "The {plugin} plugin is off, so this artifact cannot open.",
		  "open.failed": "Could not open it: {message}",
		  "open.noSession": "The conversation is gone, so the editor opened in a new window."
		};
		var SKILLS = ["claude-slides", "claude-design", "claude-design-system", "claude-dashboard", "claude-docs", "claude-motion"];
		var isSkill = (s) => SKILLS.includes(s);
		var CSS = `
		.bda-page{width:100%;min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;display:flex;flex-direction:column;overflow:hidden}
		.bda-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
		.bda-content{max-width:1080px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}
		.bda-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:20px}
		[data-platform=darwin] .bda-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
		.bda-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
		.bda-search{display:flex;align-items:center;gap:6px;width:min(260px,100%);height:34px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;color:var(--dsw-alias-label-tertiary);transition:border-color .15s}
		.bda-search:hover{border-color:var(--dsw-alias-border-l2)}
		.bda-search:focus-within{border-color:var(--dsw-alias-state-business-primary)}
		.bda-search input{flex:1;min-width:0;height:100%;border:0;padding:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
		.bda-search input::placeholder{color:var(--dsw-alias-label-caption)}
		.bda-search input::-webkit-search-cancel-button{display:none}
		.bda-search button{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:-4px;padding:0;border:0;border-radius:6px;background:none;color:inherit;cursor:pointer}
		.bda-search button:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:20px}
		.bda-tab{display:inline-flex;align-items:center;height:28px;padding:0 10px;border:0;border-radius:14px;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer}
		.bda-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-tab[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
		.bda-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:28px 20px;margin:0;padding:0;list-style:none}
		.bda-card{display:flex;flex-direction:column;gap:10px;width:100%;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
		.bda-card:disabled{cursor:progress}
		.bda-card:focus-visible{outline:none}
		.bda-card:focus-visible .bda-preview{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
		.bda-preview{position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;background:color-mix(in srgb,var(--bda-tint) 14%,var(--dsw-alias-bg-base));transition:background-color .15s}
		.bda-card:hover .bda-preview{background:color-mix(in srgb,var(--bda-tint) 22%,var(--dsw-alias-bg-base))}
		.bda-paper{position:absolute;left:14%;right:14%;top:14%;bottom:-6%;border-radius:6px 6px 0 0;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 6px 18px -8px rgba(0,0,0,.25);padding:9% 9% 0;display:flex;flex-direction:column;gap:6px;overflow:hidden;transition:transform .2s}
		.bda-card:hover .bda-paper{transform:translateY(-3px)}
		.bda-paper-title{font-size:11px;line-height:1.35;font-weight:600;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
		.bda-line{height:5px;border-radius:3px;background:var(--dsw-alias-border-l2)}
		.bda-slide{position:absolute;left:12%;right:12%;top:16%;aspect-ratio:16/9;border-radius:5px;background:var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 6px 18px -8px rgba(0,0,0,.25);display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 9%;transition:transform .2s}
		.bda-card:hover .bda-slide{transform:translateY(-3px)}
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
		.bda-film{position:absolute;left:12%;right:12%;top:16%;aspect-ratio:16/9;border-radius:5px;background:#1d1d1f;box-shadow:0 6px 18px -8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:transform .2s;color:#fff}
		.bda-card:hover .bda-film{transform:translateY(-3px)}
		.bda-film-bar{position:absolute;left:8%;right:8%;bottom:10%;height:3px;border-radius:2px;background:rgba(255,255,255,.25)}
		.bda-film-bar::after{content:"";position:absolute;left:0;top:0;bottom:0;width:38%;border-radius:2px;background:var(--bda-tint)}
		.bda-film-title{position:absolute;left:8%;right:8%;top:10%;font-size:10px;font-weight:600;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 70%,transparent);color:var(--dsw-alias-label-secondary);font-size:13px}
		.bda-spinner{width:14px;height:14px;border-radius:50%;border:1.5px solid currentColor;border-right-color:transparent;animation:bda-spin .8s linear infinite}
		@keyframes bda-spin{to{transform:rotate(360deg)}}
		.bda-info{display:flex;align-items:flex-start;gap:10px;min-width:0}
		.bda-glyph{flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:color-mix(in srgb,var(--bda-tint) 16%,var(--dsw-alias-bg-base));color:color-mix(in srgb,var(--bda-tint) 80%,var(--dsw-alias-label-primary))}
		.bda-text{display:flex;flex-direction:column;min-width:0;flex:1}
		.bda-name{font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
		.bda-note{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}
		.bda-note[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
		.bda-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:72px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
		.bda-empty svg{color:var(--dsw-alias-label-caption);margin-bottom:4px}
		.bda-empty h2{margin:0;font-size:14px;font-weight:500;color:var(--dsw-alias-label-secondary)}
		.bda-empty p{margin:0;max-width:420px;font-size:13px;line-height:1.6}
		.bda-retry{margin-top:8px;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:15px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
		.bda-retry:hover{background:var(--dsw-alias-interactive-bg-hover)}
		.bda-skeleton .bda-preview{background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-interactive-bg-hover))}
		.bda-skeleton .bda-line{width:60%;height:10px;margin-top:4px}
		@media (prefers-reduced-motion:reduce){.bda-paper,.bda-slide,.bda-film{transition:none}.bda-spinner{animation-duration:2s}}
		`;
		var TINTS = {
		  "claude-slides": "#e8865a",
		  "claude-design": "#8b7cf0",
		  "claude-design-system": "#2fa98c",
		  "claude-dashboard": "#3f8ef0",
		  "claude-docs": "#4a90e2",
		  "claude-motion": "#e2557a"
		};
		var svg = (size) => ({ display: "block", width: size, height: size, flex: "none" });
		function ArtifactsIcon({ size = 16 }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", style: svg(size), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "6", width: "8.5", height: "11", rx: "2", stroke: "currentColor", strokeWidth: "1.5" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 6V5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3.5", stroke: "currentColor", strokeWidth: "1.5" })
		  ] });
		}
		function TypeIcon({ skill, size = 16 }) {
		  const p = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
		  const body = (() => {
		    switch (skill) {
		      case "claude-slides":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.75", y: "4", width: "14.5", height: "9.5", rx: "1.5", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 13.5V16.5M7 16.5h6", ...p })
		        ] });
		      case "claude-design":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.75", y: "2.75", width: "8", height: "10", rx: "1.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "12.75", y: "6", width: "4.5", height: "11.25", rx: "1.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.75 16.25h8", ...p })
		        ] });
		      case "claude-design-system":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6.5", cy: "6.5", r: "3.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "13.5", cy: "6.5", r: "3.25", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10", cy: "13", r: "3.25", ...p })
		        ] });
		      case "claude-dashboard":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.75", y: "2.75", width: "14.5", height: "14.5", rx: "2", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 13.5V10M10 13.5V6.5M13.5 13.5V9", ...p })
		        ] });
		      case "claude-docs":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 2.75h6.5l3.5 3.5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1Z", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 10h6M7 13h4.5", ...p })
		        ] });
		      case "claude-motion":
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.75", y: "4", width: "14.5", height: "12", rx: "2", ...p }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m8.5 7.75 4 2.25-4 2.25v-4.5Z", ...p })
		        ] });
		      default:
		        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "14", height: "14", rx: "2", ...p });
		    }
		  })();
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", style: svg(size), children: body });
		}
		function SearchIcon() {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: svg(14), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7", cy: "7", r: "4.5", stroke: "currentColor", strokeWidth: "1.3" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10.5 10.5 3 3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" })
		  ] });
		}
		function ClearIcon() {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: svg(12), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4.5 4.5 7 7m0-7-7 7", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" }) });
		}
		function Preview({ skill, title }) {
		  const name = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-paper-title", children: title });
		  switch (skill) {
		    case "claude-slides":
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-slide", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-line" })
		      ] });
		    case "claude-motion":
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-film", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-film-title", children: title }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 20 20", "aria-hidden": "true", style: svg(22), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 5.5v9l7.5-4.5L7 5.5Z", fill: "currentColor" }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-film-bar" })
		      ] });
		    case "claude-design":
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-boards", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-board" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-board" })
		        ] })
		      ] });
		    case "claude-design-system":
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-swatches", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-swatch" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-swatch" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-specimen", children: "Aa" })
		      ] });
		    case "claude-dashboard":
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-kpis", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-kpi" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-kpi" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-kpi" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-bars", children: [45, 70, 55, 90, 65, 80].map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-bar", style: { height: `${h}%` } }, i)) })
		      ] });
		    default:
		      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-paper", children: [
		        name,
		        [92, 100, 84, 96, 70].map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-line", style: { width: `${w}%` } }, i))
		      ] });
		  }
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
		  const [now, setNow] = (0, import_react.useState)(() => Date.now());
		  (0, import_react.useEffect)(() => {
		    const timer = setInterval(() => setNow(Date.now()), 6e4);
		    return () => clearInterval(timer);
		  }, []);
		  return now;
		}
		function Card({ view, state, conversation, now, t, onOpen }) {
		  const opening = state.opening === view.root;
		  const failure = state.failure?.root === view.root ? state.failure.message : "";
		  const notice = state.notice?.root === view.root ? state.notice.message : "";
		  const tint = isSkill(view.skill) ? TINTS[view.skill] : "#8a8a8a";
		  const when = ago(view.openedAt, now, t);
		  const meta = conversation ? `${when} · ${t("card.in", { title: conversation })}` : when;
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
		    "button",
		    {
		      type: "button",
		      className: "bda-card",
		      style: { "--bda-tint": tint },
		      disabled: state.opening !== null,
		      "aria-busy": opening,
		      title: view.root,
		      onClick: () => onOpen(view),
		      "data-skill": view.skill,
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-preview", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Preview, { skill: view.skill, title: view.title }),
		          opening && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-busy", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-spinner" }),
		            t("card.opening")
		          ] })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-info", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-glyph", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeIcon, { skill: view.skill }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "bda-text", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-name", children: view.title }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-meta", children: meta }),
		            failure && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-note", "data-kind": "error", children: failure }),
		            notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bda-note", children: notice })
		          ] })
		        ] })
		      ]
		    }
		  ) });
		}
		function ArtifactsPage({ t, artifactsStore, sessionsStore, reloadArtifacts, openArtifact }) {
		  const state = (0, import_react.useSyncExternalStore)(artifactsStore.subscribe, artifactsStore.getSnapshot);
		  const sessions = (0, import_react.useSyncExternalStore)(sessionsStore.subscribe, sessionsStore.getSnapshot);
		  const [query, setQuery] = (0, import_react.useState)("");
		  const [skill, setSkill] = (0, import_react.useState)("all");
		  const now = useNow();
		  (0, import_react.useEffect)(() => {
		    reloadArtifacts();
		    const again = () => {
		      if (document.visibilityState === "visible") reloadArtifacts();
		    };
		    document.addEventListener("visibilitychange", again);
		    return () => document.removeEventListener("visibilitychange", again);
		  }, [reloadArtifacts]);
		  const present = (0, import_react.useMemo)(() => SKILLS.filter((s) => state.artifacts.some((a) => a.skill === s)), [state.artifacts]);
		  const shown = (0, import_react.useMemo)(() => {
		    const q = query.trim().toLowerCase();
		    return state.artifacts.filter((a) => {
		      if (skill !== "all" && a.skill !== skill) return false;
		      if (!q) return true;
		      const conversation = sessions.byId?.[a.sessionId]?.title ?? "";
		      return a.title.toLowerCase().includes(q) || conversation.toLowerCase().includes(q) || a.root.toLowerCase().includes(q);
		    });
		  }, [state.artifacts, skill, query, sessions]);
		  (0, import_react.useEffect)(() => {
		    if (skill !== "all" && state.status === "ready" && !present.includes(skill)) setSkill("all");
		  }, [skill, present, state.status]);
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "bda-page", "aria-label": t("title"), "data-testid": "baoyu-design-artifacts", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-content", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-heading", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: t("title") }),
		      state.artifacts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bda-search", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchIcon, {}),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), onChange: (e) => setQuery(e.target.value) }),
		        query && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-label": t("search.clear"), onClick: () => setQuery(""), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClearIcon, {}) })
		      ] })
		    ] }),
		    present.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-filters", role: "toolbar", children: ["all", ...present].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bda-tab", "aria-pressed": skill === s, onClick: () => setSkill(s), children: s === "all" ? t("filter.all") : t(`type.${s}`) }, s)) }),
		    state.status === "loading" && state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "bda-grid bda-skeleton", "aria-hidden": "true", children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-card", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-preview" }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-line" })
		    ] }) }, i)) }) : state.status === "error" && state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-empty", role: "alert", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("load.error", { message: state.error }) }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bda-retry", onClick: reloadArtifacts, children: t("load.retry") })
		    ] }) : state.artifacts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bda-empty", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtifactsIcon, { size: 28 }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("empty.title") }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("empty.body") })
		    ] }) : shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bda-empty", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("empty.noMatches") }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "bda-grid", children: shown.map((view) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		      Card,
		      {
		        view,
		        state,
		        conversation: sessions.byId?.[view.sessionId]?.title?.trim() ?? "",
		        now,
		        t,
		        onOpen: openArtifact
		      },
		      view.root
		    )) })
		  ] }) }) });
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
		var route = (path) => path.slice(1);
		function mountPage(ctx, h, self) {
		  const disposers = [];
		  const style = typeof document === "undefined" ? null : document.createElement("style");
		  if (style) {
		    style.dataset.pluginCss = "baoyu-design/artifacts-page.css";
		    style.textContent = CSS;
		    document.head.appendChild(style);
		    disposers.push(() => style.remove());
		  }
		  disposers.push(ctx.locale.register(NS, { zh, en }));
		  const t = ctx.locale.bind?.(NS) ?? ((key) => en[key] ?? key);
		  const skillsOn = () => [...new Set([...h.members.values()].map((m) => m.skill))];
		  const store = createStore({ status: "loading", artifacts: [], error: "", skills: skillsOn(), opening: null, failure: null, notice: null });
		  const onMembers = () => store.set({ skills: skillsOn() });
		  h.listeners.add(onMembers);
		  disposers.push(() => h.listeners.delete(onMembers));
		  let loading = null;
		  const reload = () => {
		    if (loading) return;
		    if (store.getSnapshot().artifacts.length === 0) store.set({ status: "loading" });
		    const order = [self, ...skillsOn().filter((s) => s !== self)];
		    loading = (async () => {
		      let message = "";
		      for (const skill of order) {
		        try {
		          const response = await fetch(route(listPath(skill)), { cache: "no-store" });
		          if (!response.ok) throw new Error(`HTTP ${response.status}`);
		          const body = await response.json();
		          const artifacts = Array.isArray(body.artifacts) ? body.artifacts.filter((a) => a && typeof a.root === "string") : [];
		          store.set({ status: "ready", artifacts, error: "" });
		          return;
		        } catch (error) {
		          message ||= error.message;
		        }
		      }
		      store.set({ status: "error", error: message });
		    })().finally(() => {
		      loading = null;
		    });
		  };
		  const open = (view) => {
		    if (store.getSnapshot().opening !== null) return;
		    if (!skillsOn().includes(view.skill)) {
		      store.set({ failure: { root: view.root, message: t("open.pluginOff", { plugin: view.plugin }) }, notice: null });
		      return;
		    }
		    store.set({ opening: view.root, failure: null, notice: null });
		    void (async () => {
		      try {
		        const response = await fetch(`${route(openPath(view.skill))}?${new URLSearchParams({ root: view.root })}`, { method: "POST" });
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
		          store.set({ opening: null, notice: { root: view.root, message: t("open.noSession") } });
		        }
		        reload();
		      } catch (error) {
		        store.set({ opening: null, failure: { root: view.root, message: t("open.failed", { message: error.message }) } });
		      }
		    })();
		  };
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
		        locale: NS,
		        inject: () => ({ artifactsStore: store, sessionsStore: sessionsStore(), reloadArtifacts: reload, openArtifact: open })
		      },
		      ArtifactsPage
		    )
		  )));
		  disposers.push(toDisposer(ctx.slots.inject(
		    "sidebar.panellist",
		    () => ctx.slots.register(
		      { name: "sidebar.panellist", id: PANEL_ID, order: 20, locale: NS, label: () => t("panel") },
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
		function joinArtifactsPage(ctx, plugin, skill) {
		  const h = hub();
		  h.members.set(plugin, { plugin, skill, version: PAGE_VERSION, mount: () => mountPage(ctx, h, skill) });
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

		var import_jsx_runtime2 = require("react/jsx-runtime");
		var CLIENT = define_CLIENT_default;
		var COMMENT_SOURCE = "baoyu-design-comment";
		var KIND = `${CLIENT.key}:comment`;
		var NS2 = CLIENT.key;
		var zh2 = {
		  "card.title": "已将对“{title}”的评论发给 Agent",
		  "card.request": "已将“{title}”上的 {label} 发给 Agent",
		  "card.view": "查看评论",
		  "card.more": "显示位置",
		  "card.less": "收起位置"
		};
		var en2 = {
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
		  return source?.kind === COMMENT_SOURCE && source.plugin === CLIENT.plugin;
		}
		function cardData(event) {
		  const source = event.data?.source ?? {};
		  const threads = Array.isArray(source.threads) ? source.threads : [];
		  const requests = Array.isArray(source.requests) ? source.requests : [];
		  return {
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
		var CSS2 = `
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
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: iconStyle, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2", y: "4", width: "12", height: "7", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8.5 8.5 11 14l.9-2.1L14 11l-5.5-2.5Z", fill: "currentColor", stroke: "var(--dsw-alias-markdown-code-block, #fff)", strokeWidth: "0.8", strokeLinejoin: "round" })
		  ] });
		}
		function ChevronDown() {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 4.5 6 7.5l3-3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function ChevronRight() {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4.5 3 7.5 6l-3 3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function Card2({ title, thread, url, t, openThread }) {
		  const [open, setOpen] = (0, import_react2.useState)(true);
		  const heading = t("card.title", { title });
		  const meta = !CLIENT.simple && (thread.where || url);
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-card", "data-comment-id": thread.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CommentIcon, {}),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Heading, { text: heading, title, parts: t("card.title", { title: TITLE_MARK }).split(TITLE_MARK) }),
		      meta && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "bdc-toggle", "aria-expanded": open, "aria-label": t(open ? "card.less" : "card.more"), onClick: () => setOpen(!open), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDown, {}) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bdc-body", children: thread.text }),
		    meta && open && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-meta", children: [
		      thread.where && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bdc-where", children: thread.where }),
		      url && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "bdc-view", onClick: () => openThread(url, thread.id), children: [
		        t("card.view"),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronRight, {})
		      ] })
		    ] })
		  ] });
		}
		function Heading({ text, title, parts }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bdc-head-text", title: text, children: parts.length === 2 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: parts[0] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bdc-head-title", children: title }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: parts[1] })
		  ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bdc-head-title", children: text }) });
		}
		function RequestCardView({ title, request, t }) {
		  const label = request.label || "Request";
		  const heading = t("card.request", { title, label });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-card", "data-request-id": request.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RequestIcon, {}),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Heading, { text: heading, title, parts: t("card.request", { title: TITLE_MARK, label }).split(TITLE_MARK) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bdc-body", children: request.text })
		  ] });
		}
		function CommentCards({ node, t, openThread }) {
		  const { title, url, threads, requests } = node.data;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bdc-row", children: [
		    threads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Card2, { title, thread, url, t, openThread }, thread.id)),
		    (requests ?? []).map((request) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RequestCardView, { title, request, t }, request.id))
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
		    const id = `${CLIENT.plugin}/comment-card.css`;
		    if (document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`)) return () => {
		    };
		    const tag = document.createElement("style");
		    tag.dataset.plugin = CLIENT.plugin;
		    tag.dataset.pluginCss = id;
		    tag.textContent = CSS2;
		    document.head.appendChild(tag);
		    return () => tag.remove();
		  }, `${CLIENT.plugin}: comment card styles`);
		  ctx.effect(() => ctx.locale.register(NS2, { zh: zh2, en: en2 }), `${CLIENT.plugin}: dictionaries`);
		  ctx.uiConversation.events.register(definition);
		  ctx.slots.inject(
		    "conversation.chat.node",
		    () => ctx.slots.register(
		      {
		        name: "conversation.chat.node",
		        key: KIND,
		        locale: NS2,
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
		  joinArtifactsPage(ctx, CLIENT.plugin, CLIENT.skill);
		}
		return module.exports;
	}
});
