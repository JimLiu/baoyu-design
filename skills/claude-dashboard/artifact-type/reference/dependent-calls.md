# A call that needs an earlier answer

Where one call's input comes from another call's answer (the latest date in the data, an id), write each call as a dataset of its own, stored as any query is. The sharer then approves both, so both run as the sharer, on any connector. First see whether one call can do it: in SQL, a subquery often can.

In the second dataset, write what comes from the first answer as a `{{name}}` with a `rules` entry, and leave everything else written out. In SQL write it bare (`day = {{day}}`, not `'{{day}}'`); "Filters that run as a sharer" in `artifact-type/reference/sources.md` has the rest. The page's code sets the value:

```
datasets/latest  source: {kind: "query", connector: "Cube", tool: "semantic_query", args: {concept: "latest_day"}}
datasets/daily   source: {kind: "query", connector: "Cube", tool: "semantic_query",
    args: {concept: "arr", filters: [{member: "day", values: ["{{day}}"]}]},
    rules: {day: {pattern: "[0-9]{4}-[0-9]{2}-[0-9]{2}"}}}
dash/params      {day: "2026-10-28"}
files/index.html
  <section class="lx-daily" hidden>…the marks and drawings of daily…</section>
  <script>
    dash.onData(() => {
      const day = dash.data('latest').data[0]?.day;
      if (day == null) return;
      if (dash.params().day !== day) return dash.setParams({ day });
      for (const el of document.querySelectorAll('.lx-daily')) el.hidden = false;
    });
  </script>
```

- Default: give the name the value you got when you ran the calls. Claude Data refuses null or an empty list for a name that is a whole value.
- Rule: it is all that limits the value. A viewer's browser sends it, so a viewer can send anything the rule allows, not only what the first answer said, and it runs as the sharer. The rule above allows any day, or a list of days. Make it as narrow as the data lets you, check that it matches what the first answer really returns (a `pattern` refuses a number: give a number `type: "number"`), and tell the person what it allows at hand-over.
- Fixed values: a value that must not vary stays written in `args`, where no viewer can change it.
- Coarse values: each value is run and kept separately, so send a day, not a time, when a day gives the same result.
- Lists: `values: "{{days}}"` takes a list, and the rule applies to each item. Compare lists by their items (`String(a) === String(b)`): `===` on two lists is never true, so the page would never get past `setParams`.
- `hidden`: on a page that opens with `dash-one-writer`, a mark under `hidden` loads nothing, so the second call waits for the value. On any other page it runs at the default first, which costs one call.
- Changes: on a connector someone shares, read "A connector someone shares" in `artifact-type/reference/sources.md` before you write. The new dataset runs as the sharer only after they share again.

A loader's `call` is for a query left running and for further pages. Where a connector is shared, a `call` sends the whole load to each viewer's own connector. The page tells the sharer, unless the call is Google Cloud BigQuery's poll for a query left running. For further pages on a shared connector, ask for few enough rows that one call answers, or tell the person that this query runs as each viewer.
