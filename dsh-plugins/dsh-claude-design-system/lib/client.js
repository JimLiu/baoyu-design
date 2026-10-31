// dsh-claude-design-system 2.3.0: built from baoyu-design.
window.__ModuleLoader__.load({
	id: "dsh-claude-design-system",
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

		var define_CLIENT_default = { plugin: "dsh-claude-design-system", key: "dsh-claude-design-system", simple: false };

		var import_react = require("react");
		var import_jsx_runtime = require("react/jsx-runtime");
		var CLIENT = define_CLIENT_default;
		var COMMENT_SOURCE = "baoyu-design-comment";
		var KIND = `${CLIENT.key}:comment`;
		var NS = CLIENT.key;
		var zh = {
		  "card.title": "已将对“{title}”的评论发给 Agent",
		  "card.view": "查看评论",
		  "card.more": "显示位置",
		  "card.less": "收起位置"
		};
		var en = {
		  "card.title": "Comment on “{title}” sent to agent",
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
		  return {
		    title: str(source.title),
		    url: str(source.url),
		    threads: threads.map((t) => ({ id: str(t.id), where: str(t.where), text: str(t.text) })).filter((t) => t.id),
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
		var CSS = `
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
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		    "path",
		    {
		      d: "M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.2L5.4 13.8a.3.3 0 0 1-.5-.23V11.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z",
		      stroke: "currentColor",
		      strokeWidth: "1.2",
		      strokeLinejoin: "round"
		    }
		  ) });
		}
		function ChevronDown() {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 4.5 6 7.5l3-3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function ChevronRight() {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", style: iconStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 3 7.5 6l-3 3", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
		}
		function Card({ title, thread, url, t, openThread }) {
		  const [open, setOpen] = (0, import_react.useState)(true);
		  const heading = t("card.title", { title });
		  const split = t("card.title", { title: TITLE_MARK }).split(TITLE_MARK);
		  const parts = split.length === 2 ? split : void 0;
		  const meta = !CLIENT.simple && (thread.where || url);
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bdc-card", "data-comment-id": thread.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bdc-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommentIcon, {}),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bdc-head-text", title: heading, children: parts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: parts[0] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bdc-head-title", children: title }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: parts[1] })
		      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bdc-head-title", children: heading }) }),
		      meta && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bdc-toggle", "aria-expanded": open, "aria-label": t(open ? "card.less" : "card.more"), onClick: () => setOpen(!open), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {}) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdc-body", children: thread.text }),
		    meta && open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bdc-meta", children: [
		      thread.where && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdc-where", children: thread.where }),
		      url && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "bdc-view", onClick: () => openThread(url, thread.id), children: [
		        t("card.view"),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {})
		      ] })
		    ] })
		  ] });
		}
		function CommentCards({ node, t, openThread }) {
		  const { title, url, threads } = node.data;
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bdc-row", children: threads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { title, thread, url, t, openThread }, thread.id)) });
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
		    tag.textContent = CSS;
		    document.head.appendChild(tag);
		    return () => tag.remove();
		  }, `${CLIENT.plugin}: comment card styles`);
		  ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${CLIENT.plugin}: dictionaries`);
		  ctx.uiConversation.events.register(definition);
		  ctx.slots.inject(
		    "conversation.chat.node",
		    () => ctx.slots.register(
		      {
		        name: "conversation.chat.node",
		        key: KIND,
		        locale: NS,
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
		}
		return module.exports;
	}
});
