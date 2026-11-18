const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, "../../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      imports[name] ??
      (name === "@/lib/advisor/formats"
        ? load("lib/advisor/formats.ts")
        : name === "@/components/advisor/date-input"
          ? {
              DateInput: ({ value, onValueChange, withTime, ...props }) =>
                React.createElement("input", {
                  ...props,
                  value,
                  type: withTime ? "datetime-local" : "date",
                  onChange: (e) => onValueChange(e.target.value),
                }),
            }
          : require(name)),
    URLSearchParams,
    Date,
    AbortController,
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout() {},
    ...globals,
  });
  return module.exports;
}
const tickets = load("lib/advisor/service-tickets.ts");
const link = {
  default: ({ children, scroll, ...props }) =>
    React.createElement("a", props, children),
};
const { ServiceTicketsTable } = load(
  "components/advisor/service-tickets-table.tsx",
  {
    "next/link": link,
    "@/lib/advisor/service-tickets": tickets,
    "@/components/admin/primitives": {
      EmptyState: ({ title, description }) =>
        React.createElement("div", null, title, description),
    },
  },
);
module.exports = { load, tickets, link, ServiceTicketsTable };
