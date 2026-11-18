import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import renderer from "./helpers/service-ticket-render.cjs";

const { load } = renderer;
const { formatOdometer } = load("lib/advisor/formats.ts");

function field(initial = "", max) {
  let value = initial,
    effects = [],
    node;
  const input = {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    validation: "",
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    setCustomValidity(message) {
      this.validation = message;
    },
  };
  const { OdometerInput } = load("components/ui/odometer-input.tsx", {
    react: {
      ...React,
      useRef: () => ({ current: input }),
      useEffect: (effect) => effects.push(effect),
    },
  });
  const render = () => {
    node = OdometerInput({
      value,
      max,
      onValueChange: (digits) => {
        value = digits;
      },
    });
    input.value = node.props.value;
    for (const effect of effects.splice(0)) effect();
  };
  render();
  return {
    input,
    get value() {
      return value;
    },
    edit(raw, caret = raw.length) {
      input.value = raw;
      input.setSelectionRange(caret, caret);
      node.props.onChange({ currentTarget: input });
      render();
    },
    key(key, caret) {
      input.setSelectionRange(caret, caret);
      node.props.onKeyDown({
        key,
        currentTarget: input,
        defaultPrevented: false,
      });
    },
    component: OdometerInput,
  };
}

test("ODO groups digits with dots consistently, including zero and already formatted values", () => {
  for (const [value, expected] of [
    [null, ""],
    [undefined, ""],
    ["", ""],
    [0, "0"],
    ["0000", "0"],
    [999, "999"],
    [1000, "1.000"],
    [100000, "100.000"],
    [9999999, "9.999.999"],
    ["100.000", "100.000"],
    ["12345678901234567890", "12.345.678.901.234.567.890"],
  ]) {
    assert.equal(formatOdometer(value), expected);
  }
});

test("ODO formats every keystroke and pasted grouping while keeping raw digits and the edit position", () => {
  const f = field();
  for (const [raw, expected] of [
    ["1", "1"],
    ["10", "10"],
    ["100", "100"],
    ["1000", "1.000"],
    ["1.0000", "10.000"],
    ["10.0000", "100.000"],
  ]) {
    f.edit(raw);
    assert.equal(f.input.value, expected);
    assert.equal(f.input.selectionStart, expected.length);
  }
  assert.equal(f.value, "100000");
  f.edit("1293.456", 3);
  assert.equal(f.input.value, "1.293.456");
  assert.equal(f.input.selectionStart, 4);
  f.edit("1 000 000");
  assert.equal(f.value, "1000000");
  assert.equal(f.input.value, "1.000.000");
  for (const invalid of ["-100", "1e3", "100km"]) {
    f.edit(invalid);
    assert.equal(f.value, "1000000");
  }
  f.edit("");
  assert.equal(f.value, "");
  assert.equal(f.input.value, "");
});

test("ODO Backspace/Delete cross grouping dots, and the existing maximum remains validated", () => {
  const f = field(100000, 9999999);
  f.key("Backspace", 4);
  assert.equal(f.input.selectionStart, 3);
  f.edit("10.000", 2);
  assert.equal(f.value, "10000");
  f.edit("100.000");
  f.key("Delete", 3);
  assert.equal(f.input.selectionStart, 4);
  f.edit("100.00", 4);
  assert.equal(f.value, "10000");
  f.edit("10000000");
  assert.match(f.input.validation, /9\.999\.999/);
  f.edit("0");
  assert.equal(f.input.validation, "");
  f.edit("");
  assert.equal(f.input.validation, "");
});

test("ODO intake stores integer values and preserves the difference between zero and missing", () => {
  let saved;
  const OdometerInput = field().component;
  const { emptyIntake } = load("lib/api/visits.ts");
  const { VisitIntakeFields } = load(
    "components/advisor/visit-intake-fields.tsx",
    {
      react: { ...React, useState: (initial) => [initial, () => {}] },
      "@/components/ui/odometer-input": { OdometerInput },
      "@/lib/api/client": {},
      "@/lib/advisor/seed": { operationChecks: [] },
    },
  );
  function find(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === OdometerInput) return node;
    for (const child of React.Children.toArray(node.props.children)) {
      const result = find(child);
      if (result) return result;
    }
  }
  const input = find(
    VisitIntakeFields({
      value: emptyIntake,
      onChange: (value) => {
        saved = value;
      },
      inspection: false,
    }),
  );
  input.props.onValueChange("100000");
  assert.equal(saved.odometer, 100000);
  input.props.onValueChange("0");
  assert.equal(saved.odometer, 0);
  input.props.onValueChange("");
  assert.equal(saved.odometer, null);
});
