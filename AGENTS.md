# DPAuto — Codex Agent Instructions

## Core principle: preserve the existing design system

This project already has an established website template and visual identity. Treat the current codebase as the **single source of truth** for UI/UX decisions. All future features, pages, refinements, and fixes MUST look and behave like a natural extension of the existing product.

**Do not import, imitate, or invent external visual styles.** The existing template takes precedence over generic design trends, Codex preferences, and examples from other websites.

## Mandatory workflow before UI changes

1. Inspect the relevant existing pages, layouts, components, stylesheets, theme configuration, design tokens, assets, and responsive patterns.
2. Identify the closest existing component or screen pattern that can be reused.
3. Prefer composition and reuse over creating new components or styles.
4. If a new component is necessary, build it using existing tokens, utilities, conventions, and interaction patterns.
5. Keep changes within the requested feature or screen. Avoid unrelated redesigns or global styling changes.
6. Verify the result at mobile, tablet, and desktop widths appropriate to the existing project.

If an applicable design decision cannot be inferred from the codebase, **ask the user before introducing a new visual convention**. Do not silently invent one.

## Visual identity — strict rules

- Preserve the established red-and-white brand identity and the **exact colors/tokens already defined in the repository**. Do not invent new shades, gradients, accent colors, or palettes simply because they look better.
- Reuse existing typography: font families, weights, sizes, line heights, and text hierarchy.
- Reuse existing spacing, sizing, container widths, grid rules, breakpoints, border radii, borders, shadows, icons, and imagery conventions.
- Reuse existing buttons, inputs, cards, navigation, dialogs, tables, status indicators, empty states, and feedback patterns.
- Reuse existing transitions, animation timing, easing, hover/focus/active states, and motion conventions. Do not introduce decorative animations or visual effects without explicit approval.
- Do not copy UI from external websites, screenshots, design galleries, component libraries, or templates unless the user explicitly authorizes that specific reference.
- Do not add a new UI framework, component library, icon pack, animation library, or styling system without explicit approval.
- Do not override global design tokens or shared styles to solve a local feature request.
- Do not replace existing components with visually different alternatives solely for aesthetic reasons.

**Important:** Red and white describe the brand direction, not permission to create a new red-and-white design system. Use the repository's existing implementation.

## Feature development and UI changes

- New features must integrate into existing navigation, layout, data presentation, forms, and user flows.
- For new pages, use the nearest existing page as the structural and visual reference.
- For admin screens, follow the admin application's own established design system. Do not assume the public landing page and admin use identical components or styling.
- Maintain existing mobile-first behavior where applicable, particularly for service advisors using phones and tablets.
- Preserve accessibility: semantic markup, keyboard access, visible focus states, readable contrast, and appropriately sized touch targets, following existing conventions.
- Do not redesign neighboring pages or unrelated components as part of a feature request.
- Preserve existing business logic, API contracts, routes, permissions, and data handling unless the task explicitly requires changing them.

## Reuse hierarchy

When implementing UI, follow this order:

1. Reuse an existing component without modification.
2. Extend an existing component through its supported props or variants without breaking current usages.
3. Compose multiple existing components into the required interface.
4. Create a new component that strictly follows existing project patterns.
5. Propose a design-system addition only if no existing pattern fits; obtain approval before implementation.

Avoid duplicate components, one-off visual tokens, hardcoded colors, and arbitrary CSS values when project equivalents exist.

## Scope and change safety

- Make the smallest change that fully satisfies the request.
- Do not perform unsolicited refactoring, redesign, dependency upgrades, or broad formatting changes.
- Before editing shared components or global styles, check their other usages and potential regressions.
- Keep responsive behavior consistent and avoid layout shifts, horizontal overflow, or broken touch interactions.
- Run the relevant existing lint, typecheck, build, or tests when feasible; clearly report anything not run.
- Do not claim that UI was visually verified unless it was actually inspected in a browser or screenshot.

## Minimal Testing — applies to all future tasks

This section governs how the existing testing, validation, and responsive verification requirements are carried out. Preserve those requirements while applying the limits below; earlier references to running checks or builds are not permission to run comprehensive validation automatically.

1. **Default to the smallest relevant scope.** Test only the code just changed and directly affected behavior. Do not expand verification to unrelated files, features, routes, or devices.
2. **Do not automatically run the full test suite, E2E, Playwright, Lighthouse, benchmarks, or a production build.** Run these only when explicitly requested or approved by the user.
3. **Run each successful check only once per task.** Do not repeat a passing check for reassurance or as an additional final check.
4. **Limit retries after failure.** Fix and rerun only the failing check and the related code, with at most **two fix-and-retest attempts after the initial failure**. If it still fails, stop retrying, report the remaining issue briefly, and ask before further testing.
5. **Avoid duplicate validation.** Do not run multiple commands that verify the same thing. Choose the narrowest suitable check instead of stacking overlapping lint, typecheck, test, and build commands.
6. **For small UI, CSS, or text changes, prefer static inspection.** Review the changed component, relevant styles, types, and responsive rules. Do not automatically build or start browser automation. Do not describe static inspection as visual browser verification.
7. **For API, database, authentication, authorization, or security changes, perform the necessary related tests.** Cover the affected behavior, permissions, data integrity, and failure cases as applicable. Keep the scope focused; if a prohibited automatic check or comprehensive validation is needed, obtain approval first.
8. **Ask before comprehensive testing.** Explain the concrete reason, proposed scope, and commands. Proceed only after explicit user authorization; an existing explicit request for that validation already supplies authorization.
9. **Report results briefly.** State what was checked, whether it passed, and any unresolved failure or omitted necessary check. Do not output long logs; include only the relevant error excerpt when needed.

## Communication and approval

- Communicate plans, questions, and implementation summaries in **Vietnamese**.
- Before substantial UI work, briefly state which existing pages/components/patterns will be reused.
- If the request conflicts with the existing design system, explain the conflict and request a decision instead of silently changing the design.
- If the user explicitly requests a new visual direction, treat that as a scoped exception for the requested area only; do not propagate it to the rest of the product.
- In the final report, summarize changed files, reused UI patterns, verification performed, and any remaining risks.

## Definition of done

A UI task is complete only when:

- The result visually belongs to the existing DPAuto product.
- Existing components and tokens were reused wherever possible.
- No unapproved external design style, palette, library, or decorative effect was introduced.
- Relevant mobile, tablet, and desktop layouts remain usable.
- Unrelated pages and shared behavior remain unchanged.

**Default decision when uncertain: preserve the current design and ask before introducing anything new.**

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
