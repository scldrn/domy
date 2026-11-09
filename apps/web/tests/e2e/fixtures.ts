import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { apiPort } from "./ports";

type Role = "owner" | "dispatcher" | "courier";

const authFile = (role: Role) => new URL(`.auth/${role}.json`, import.meta.url).pathname;

/** WCAG 2.2 AA violations of the page as it is now (FR-034). */
export async function accessibilityViolations(
  page: Page,
  beforeAnalyze?: () => Promise<void>,
  beforePause?: () => Promise<void>,
): Promise<string[]> {
  // A toast mounts one frame before its entrance transition starts; until Sonner marks it
  // mounted, no animation is running yet and axe would read it half transparent.
  const settleAnimations = () =>
    page.waitForFunction(
      () =>
        [...document.querySelectorAll("[data-sonner-toast]:not([data-removed=true])")].every(
          (toast) => toast.getAttribute("data-mounted") === "true",
        ) &&
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .every((animation) => animation.playState !== "running"),
    );
  // A closing dialog still has its role until its exit animation ends. Classify the
  // visible screen only afterward, or its background toast would escape stabilization.
  await settleAnimations();
  // T100: waiting for entrance animations alone cannot stop a dismissal during axe.
  // Sonner's native shortcut expands the stack and pauses its timer. T154: Base UI
  // preserves aria-live notifications even with a modal; restore its focus before axe.
  const hasModal =
    (await page.getByRole("dialog").count()) > 0 ||
    (await page.getByRole("alertdialog").count()) > 0;
  const notifications = await page
    .locator("[data-sonner-toast]:not([data-removed=true])")
    .evaluateAll((toasts) => ({
      present: toasts.length > 0,
      expanded: toasts.every((toast) => toast.getAttribute("data-expanded") === "true"),
    }));
  const hasNotifications = notifications.present;
  const previousFocus = hasNotifications
    ? await page.evaluateHandle(() => document.activeElement)
    : null;
  const wasInNotifications = previousFocus
    ? await previousFocus.evaluate((element) => Boolean(element?.closest("[data-sonner-toaster]")))
    : false;
  let expandedByScan = false;
  try {
    if (hasNotifications && !notifications.expanded) {
      // T112: tests can advance native expiry between discovery and stabilization.
      await beforePause?.();
      // The pointer may remain where the just-closed dialog's submit button was. Keep
      // stack expansion from moving a toast away from it and firing mouseleave mid-scan.
      await page.mouse.move(0, 0);
      expandedByScan = true;
      await page.keyboard.press("Alt+t");
      if (!hasModal)
        await page.waitForFunction(
          () =>
            Boolean(document.activeElement?.closest("[data-sonner-toaster]")) ||
            document.querySelector("[data-sonner-toast]:not([data-removed=true])") === null,
        );
      // Discovery and the shortcut are separate browser steps: expiry may win between them.
      // Read absence/expansion atomically; every toast still present must be stabilized.
      await expect
        .poll(() =>
          page.evaluate(() =>
            [...document.querySelectorAll("[data-sonner-toast]:not([data-removed=true])")].every(
              (toast) => toast.getAttribute("data-expanded") === "true",
            ),
          ),
        )
        .toBe(true);
      if (hasModal && previousFocus)
        await previousFocus.evaluate((element) => {
          if (element instanceof HTMLElement && element.isConnected)
            element.focus({ preventScroll: true });
        });
    }
    await settleAnimations();
    await beforeAnalyze?.();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // Base UI's invisible focus guards around popups take role="button" only in Safari,
      // so VoiceOver can move past them; they are never shown or named, by design.
      .exclude("[data-base-ui-focus-guard]")
      .analyze();
    return results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""} ${node.html.slice(0, 160)}`).join("; ")})`,
    );
  } finally {
    if (previousFocus) {
      if (expandedByScan) {
        await page.mouse.move(0, 0);
        if (hasModal) {
          // T154: synthetic scanner-only release, NOT a real hover/hit-test.
          // Escape would also close the modal; never collapse a preexpanded user stack.
          await page.locator("[data-sonner-toaster]").evaluateAll((toasters) => {
            for (const toaster of toasters)
              toaster.dispatchEvent(
                new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
              );
          });
          await expect
            .poll(() =>
              page.evaluate(() =>
                [
                  ...document.querySelectorAll("[data-sonner-toast]:not([data-removed=true])"),
                ].every((toast) => toast.getAttribute("data-expanded") === "false"),
              ),
            )
            .toBe(true);
        } else if (
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest("[data-sonner-toaster]")),
          )
        )
          await page.keyboard.press("Escape");
      }
      if (!wasInNotifications)
        await previousFocus.evaluate((element) => {
          if (element instanceof HTMLElement && element.isConnected)
            element.focus({ preventScroll: true });
        });
      await previousFocus.dispose();
    }
  }
}

/**
 * Internal identifiers the screen shows as text (T003, SC-005, research R8): a person reads
 * names, tracking numbers, and dates, never a record's UUID. Attributes and URLs are not text,
 * and hidden nodes are not shown. Each finding names the text it sits in. Test data must not
 * embed a whole UUID in a name or email either, or it would be reported here.
 */
export async function visibleIdentifiers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      const text = node.textContent ?? "";
      if (parent && uuid.test(text) && parent.checkVisibility({ visibilityProperty: true }))
        found.add(`<${parent.tagName.toLowerCase()}> ${text.trim().slice(0, 120)}`);
    }
    return [...found];
  });
}

/** The courier app uses 48 px hit areas even where WCAG's minimum target is smaller (FR-038). */
export async function courierTargetViolations(page: Page): Promise<string[]> {
  const controls = await page
    .locator(
      'a[href], button, input:not([type="file"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select, summary, label:has(input[type="radio"]), label:has(input[type="checkbox"])',
    )
    .elementHandles();
  const violations: string[] = [];
  for (let index = 0; index < controls.length; index += 1) {
    // Keep the actual DOM node discovered at the start of this scan. A locator nth() is
    // reevaluated after each await, so an expiring toast can shift later controls to new
    // ordinals and make the scan inspect a different button than the one it scrolled.
    const control = controls[index];
    if (!control || !(await control.isVisible())) continue;
    const visuallyHidden = await control.evaluate(
      (element) =>
        element instanceof HTMLElement &&
        element.classList.contains("sr-only") &&
        !element.matches(":focus"),
    );
    if (visuallyHidden) continue;

    // Scroll each actual target through Playwright's native action, then hit-test it.
    // This includes controls below the fixed navigation rather than silently skipping them.
    try {
      await control.scrollIntoViewIfNeeded();
    } catch (error) {
      // A transient notification control can disappear after the snapshot. Ignore only that
      // detached target; keep surfacing unrelated locator or browser errors.
      if (!(await control.isVisible())) continue;
      throw error;
    }
    const waitForGeometry = (previousCenterY: number | null) =>
      control.evaluate(
        (element, priorCenterY) =>
          new Promise<void>((resolve) => {
            if (!(element instanceof HTMLElement)) {
              resolve();
              return;
            }
            let frames = 0;
            let previousY =
              (element.getBoundingClientRect().top + element.getBoundingClientRect().bottom) / 2;
            let stableFrames = 0;
            let moved = priorCenterY === null;
            const waitForLayout = () => {
              frames += 1;
              const bounds = element.getBoundingClientRect();
              const centerY = (bounds.top + bounds.bottom) / 2;
              if (priorCenterY !== null && Math.abs(centerY - priorCenterY) >= 1) moved = true;
              stableFrames = Math.abs(centerY - previousY) < 1 ? stableFrames + 1 : 0;
              previousY = centerY;
              if ((moved && stableFrames >= 2) || frames >= 30) resolve();
              else requestAnimationFrame(waitForLayout);
            };
            requestAnimationFrame(waitForLayout);
          }),
        previousCenterY,
      );
    await waitForGeometry(null);
    const inspectTarget = () =>
      control.evaluate((element) => {
        const target =
          element instanceof HTMLInputElement &&
          (element.type === "radio" || element.type === "checkbox")
            ? (element.labels?.item(0) ?? element.closest("label") ?? element)
            : element;
        const inactive = {
          identity: "unknown",
          problem: null,
          centerY: 0,
          scrollDelta: 0,
          canScroll: false,
          bounds: "unavailable",
          scrollPosition: "unavailable",
          wheelX: null,
          wheelY: null,
        };
        if (!(target instanceof HTMLElement)) return inactive;
        const style = window.getComputedStyle(target);
        if (
          target.getClientRects().length === 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        )
          return { ...inactive, identity: target.tagName.toLowerCase(), bounds: "hidden" };

        const tag = target.tagName.toLowerCase();
        const type = target.getAttribute("type");
        const role = target.getAttribute("role");
        const id = target.id;
        const identity = [
          tag,
          ...(type ? [`type=${type}`] : []),
          ...(role ? [`role=${role}`] : []),
          ...(id ? [`id=${id}`] : []),
        ].join(" ");
        const activeModal = document.querySelector<HTMLElement>(
          'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [data-slot="sheet-content"][role="dialog"][data-open]',
        );
        const outsideModal = Boolean(activeModal && !activeModal.contains(target));
        const notification = Boolean(target.closest("[data-sonner-toast]"));
        if (target.closest("[inert]") || (outsideModal && !notification))
          return { ...inactive, identity, bounds: "inactive surface" };

        const bounds = target.getBoundingClientRect();
        const width = Math.round(bounds.width * 100) / 100;
        const height = Math.round(bounds.height * 100) / 100;
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const sizeProblem =
          width < 48 || height < 48
            ? `is ${String(width)} by ${String(height)} CSS px; expected 48 by 48`
            : null;
        let scrollPort: HTMLElement | null = null;
        let ancestor = target.parentElement;
        while (ancestor) {
          const ancestorStyle = window.getComputedStyle(ancestor);
          if (
            ["auto", "overlay", "scroll"].includes(ancestorStyle.overflowY) &&
            ancestor.scrollHeight > ancestor.clientHeight
          ) {
            scrollPort = ancestor;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        const portBounds = scrollPort?.getBoundingClientRect();
        const portLeft = scrollPort && portBounds ? portBounds.left + scrollPort.clientLeft : 0;
        const portTop = scrollPort && portBounds ? portBounds.top + scrollPort.clientTop : 0;
        const portRight = scrollPort ? portLeft + scrollPort.clientWidth : window.innerWidth;
        const portBottom = scrollPort ? portTop + scrollPort.clientHeight : window.innerHeight;
        const scrollTop = scrollPort ? scrollPort.scrollTop : window.scrollY;
        const maxScroll = scrollPort
          ? scrollPort.scrollHeight - scrollPort.clientHeight
          : Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const scrollPosition = scrollPort
          ? `${scrollPort.tagName.toLowerCase()} ${String(Math.round(scrollTop))}/${String(maxScroll)}`
          : `window ${String(Math.round(scrollTop))}/${String(maxScroll)}`;
        const geometry = `x ${String(Math.round(bounds.left))}–${String(Math.round(bounds.right))}, y ${String(Math.round(bounds.top))}–${String(Math.round(bounds.bottom))} px in ${String(window.innerWidth)}×${String(window.innerHeight)} px viewport`;
        const isDisabled =
          (target instanceof HTMLButtonElement && target.disabled) ||
          (target instanceof HTMLInputElement && target.disabled) ||
          (target instanceof HTMLTextAreaElement && target.disabled) ||
          (target instanceof HTMLSelectElement && target.disabled);
        if (isDisabled)
          return {
            identity,
            problem: sizeProblem,
            centerY,
            scrollDelta: 0,
            canScroll: false,
            bounds: geometry,
            scrollPosition,
            wheelX: null,
            wheelY: null,
          };

        const targetHit = { found: false };
        const isTargetHit = (x: number, y: number) => {
          const hit = document.elementFromPoint(x, y);
          const matches = hit === target || (hit instanceof Node && target.contains(hit));
          if (matches) targetHit.found = true;
          return matches;
        };
        const left = Math.max(bounds.left, portLeft);
        const top = Math.max(bounds.top, portTop);
        const right = Math.min(bounds.right - 48, portRight - 48);
        const bottom = Math.min(bounds.bottom - 48, portBottom - 48);
        const candidateXs = [left, (left + right) / 2, right];
        const candidateYs = [top, (top + bottom) / 2, bottom];
        const hasUncoveredHitArea =
          right >= left &&
          bottom >= top &&
          candidateXs.some((x) =>
            candidateYs.some((y) =>
              [8, 24, 40].every((offsetX) =>
                [8, 24, 40].every((offsetY) => isTargetHit(x + offsetX, y + offsetY)),
              ),
            ),
          );
        isTargetHit(centerX, centerY);

        const isScrollable = (candidate: Element): boolean => {
          const candidateStyle = window.getComputedStyle(candidate);
          return (
            ["auto", "overlay", "scroll"].includes(candidateStyle.overflowY) &&
            candidate.scrollHeight > candidate.clientHeight
          );
        };
        const nearestScrollPort = (candidate: Element | null): Element | null => {
          let current = candidate;
          while (current) {
            if (isScrollable(current)) return current;
            current = current.parentElement;
          }
          return null;
        };
        const positionedOverlays: {
          element: HTMLElement;
          top: number;
          bottom: number;
          left: number;
          right: number;
          identity: string;
        }[] = [];
        const recordPositionedAncestor = (hit: Element | null) => {
          let current = hit;
          let occupied: { top: number; bottom: number; left: number; right: number } | undefined =
            hit?.getBoundingClientRect();
          while (current) {
            const currentBounds = current.getBoundingClientRect();
            if (occupied) {
              occupied = {
                top: Math.min(occupied.top, currentBounds.top),
                bottom: Math.max(occupied.bottom, currentBounds.bottom),
                left: Math.min(occupied.left, currentBounds.left),
                right: Math.max(occupied.right, currentBounds.right),
              };
            }
            if (!current.contains(target)) {
              const position = window.getComputedStyle(current).position;
              if (
                (position === "fixed" || position === "sticky") &&
                current instanceof HTMLElement
              ) {
                const overlayBounds = occupied ?? currentBounds;
                if (
                  overlayBounds.right > portLeft &&
                  overlayBounds.left < portRight &&
                  overlayBounds.bottom > portTop &&
                  overlayBounds.top < portBottom
                ) {
                  const existing = positionedOverlays.find(
                    (overlay) => overlay.element === current,
                  );
                  if (existing) {
                    existing.top = Math.min(existing.top, overlayBounds.top);
                    existing.bottom = Math.max(existing.bottom, overlayBounds.bottom);
                    existing.left = Math.min(existing.left, overlayBounds.left);
                    existing.right = Math.max(existing.right, overlayBounds.right);
                  } else {
                    positionedOverlays.push({
                      element: current,
                      top: overlayBounds.top,
                      bottom: overlayBounds.bottom,
                      left: overlayBounds.left,
                      right: overlayBounds.right,
                      identity: current.tagName.toLowerCase(),
                    });
                  }
                }
                break;
              }
            }
            current = current.parentElement;
          }
        };
        if (!hasUncoveredHitArea) {
          const visibleLeft = Math.max(bounds.left, portLeft);
          const visibleRight = Math.min(bounds.right, portRight);
          const visibleTop = Math.max(bounds.top, portTop);
          const visibleBottom = Math.min(bounds.bottom, portBottom);
          if (visibleRight > visibleLeft && visibleBottom > visibleTop) {
            for (const x of [visibleLeft + 1, (visibleLeft + visibleRight) / 2, visibleRight - 1])
              for (const y of [visibleTop + 1, (visibleTop + visibleBottom) / 2, visibleBottom - 1])
                recordPositionedAncestor(document.elementFromPoint(x, y));
          }
          const probeXs = [portLeft + 4, (portLeft + portRight) / 2, portRight - 4];
          const probeYs = [
            portTop + 4,
            portTop + 32,
            portTop + 64,
            (portTop + portBottom) / 2,
            portBottom - 64,
            portBottom - 32,
            portBottom - 4,
          ].filter((y) => y > portTop && y < portBottom);
          for (const x of probeXs)
            for (const y of probeYs) recordPositionedAncestor(document.elementFromPoint(x, y));
        }
        if (outsideModal && !targetHit.found)
          return { ...inactive, identity, bounds: `${geometry}; inactive behind modal` };

        const intervals = positionedOverlays
          .map((overlay) => ({
            top: Math.max(portTop, overlay.top),
            bottom: Math.min(portBottom, overlay.bottom),
          }))
          .filter((interval) => interval.bottom > interval.top)
          .sort((first, second) => first.top - second.top);
        const clearBands: { top: number; bottom: number }[] = [];
        let cursor = portTop;
        for (const interval of intervals) {
          if (interval.top > cursor) clearBands.push({ top: cursor, bottom: interval.top });
          cursor = Math.max(cursor, interval.bottom);
        }
        if (portBottom > cursor) clearBands.push({ top: cursor, bottom: portBottom });
        const usableBands = clearBands.filter((band) => band.bottom - band.top >= height);
        const fallbackBand = { top: portTop, bottom: portBottom };
        const safeBand = usableBands.reduce((selected, band) => {
          const selectedHeight = selected.bottom - selected.top;
          const bandHeight = band.bottom - band.top;
          const selectedDistance = Math.abs((selected.top + selected.bottom) / 2 - centerY);
          const bandDistance = Math.abs((band.top + band.bottom) / 2 - centerY);
          return bandHeight > selectedHeight ||
            (bandHeight === selectedHeight && bandDistance < selectedDistance)
            ? band
            : selected;
        }, usableBands[0] ?? fallbackBand);
        const safeMargin = Math.min(48, Math.max(0, (safeBand.bottom - safeBand.top - height) / 4));
        const minCenterY = safeBand.top + height / 2 + safeMargin;
        const maxCenterY = safeBand.bottom - height / 2 - safeMargin;
        const desiredCenterY = Math.max(minCenterY, Math.min(centerY, maxCenterY));
        const scrollDelta =
          Math.abs(centerY - desiredCenterY) < 1 ? 0 : Math.round(centerY - desiredCenterY);
        const canMove = scrollDelta > 0 ? scrollTop < maxScroll : scrollTop > 0;
        const isPositioned = (candidate: Element | null): boolean => {
          let current = candidate;
          while (current) {
            if (!current.contains(target)) {
              const position = window.getComputedStyle(current).position;
              if (position === "fixed" || position === "sticky") return true;
            }
            current = current.parentElement;
          }
          return false;
        };
        const isInteractive = (candidate: Element | null): boolean =>
          Boolean(
            candidate?.closest(
              'a[href], button, input, textarea, select, summary, [role="button"]',
            ),
          );
        const pointerXs = scrollPort
          ? [portLeft + 4, portLeft + 8, portRight - 8, (portLeft + portRight) / 2]
          : [Math.min(8, window.innerWidth - 1), Math.max(1, window.innerWidth - 8)];
        let wheelX: number | null = null;
        let wheelY: number | null = null;
        for (const x of pointerXs) {
          const hit = document.elementFromPoint(x, desiredCenterY);
          if (!hit || isInteractive(hit) || isPositioned(hit)) continue;
          const nearest = nearestScrollPort(hit);
          const reachesPort = scrollPort
            ? scrollPort.contains(hit) && nearest === scrollPort
            : nearest === null || nearest === document.body || nearest === document.documentElement;
          if (reachesPort) {
            wheelX = x;
            wheelY = desiredCenterY;
            break;
          }
        }
        const blockerLabels = [...new Set(positionedOverlays.map((overlay) => overlay.identity))];
        const blockedProblem = `has no visible, uncovered 48 by 48 CSS px hit area (${geometry}; scroll ${scrollPosition}${blockerLabels.length ? `; fixed/sticky ${blockerLabels.join(", ")}` : ""})`;
        const problem = hasUncoveredHitArea ? sizeProblem : (sizeProblem ?? blockedProblem);
        return {
          identity,
          problem,
          centerY,
          scrollDelta,
          canScroll:
            !hasUncoveredHitArea &&
            sizeProblem === null &&
            scrollDelta !== 0 &&
            canMove &&
            wheelX !== null &&
            wheelY !== null,
          bounds: geometry,
          scrollPosition,
          wheelX,
          wheelY,
        };
      });
    let inspection = await inspectTarget();
    const scrollAttempts: string[] = [];
    for (
      let scroll = 0;
      inspection.canScroll && inspection.scrollDelta !== 0 && scroll < 3;
      scroll += 1
    ) {
      const previousY = inspection.centerY;
      const scrollDelta = inspection.scrollDelta;
      if (inspection.wheelX === null || inspection.wheelY === null) break;
      await page.mouse.move(inspection.wheelX, inspection.wheelY);
      await page.mouse.wheel(0, scrollDelta);
      await waitForGeometry(previousY);
      const nextInspection = await inspectTarget();
      scrollAttempts.push(
        `wheel ${scrollDelta > 0 ? "+" : ""}${String(scrollDelta)} px; center ${String(Math.round(previousY))}→${String(Math.round(nextInspection.centerY))}; ${nextInspection.scrollPosition}`,
      );
      if (Math.abs(nextInspection.centerY - previousY) < 1) {
        inspection = nextInspection;
        break;
      }
      inspection = nextInspection;
    }
    if (inspection.problem)
      violations.push(
        `Courier target ${String(index + 1)} ${inspection.identity} ${inspection.problem}${scrollAttempts.length ? `; native scroll attempts: ${scrollAttempts.join(" | ")}` : ""}`,
      );
  }
  return violations;
}

/** Axe, responsive width, scheme, size and real hit testing for one courier screen (T083, FR-038). */
export async function assertCourierScreen(
  page: Page,
  scheme: "light" | "dark" | "high-contrast",
): Promise<void> {
  expect(await page.evaluate(() => window.innerWidth), "courier viewport width").toBe(360);
  // Light and dark follow the phone, so only high contrast names a scheme (feature 006).
  if (scheme === "high-contrast")
    await expect(page.locator("html")).toHaveAttribute("data-scheme", scheme);
  else await expect(page.locator("html")).not.toHaveAttribute("data-scheme");
  expect(await accessibilityViolations(page), `WCAG 2.2 AA in ${scheme}`).toEqual([]);
  expect(await courierTargetViolations(page), `48 px visible targets in ${scheme}`).toEqual([]);
}

/** Whether the test passed and left a loaded screen to check. */
function endedOnScreen(page: Page): boolean {
  const info = test.info();
  return info.status === info.expectedStatus && !page.isClosed() && page.url().startsWith("http");
}

type Surface = "panel" | "courier" | "public";

/** The surface a screen belongs to, which decides the variants it is checked in (research R9). */
function surfaceOf(url: string): Surface {
  const { pathname } = new URL(url);
  if (pathname.startsWith("/mensajero")) return "courier";
  if (/^\/(seguimiento|cliente|ingresar|recuperar|restablecer)(\/|$)/.test(pathname))
    return "public";
  return "panel";
}

/**
 * How far the page itself scrolls sideways, naming the outermost element that sticks out of
 * it; what overflows inside its own scroll container (a wide table, a row of tabs) does not
 * count.
 */
export async function sidewaysScroll(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    if (extra <= 0) return null;
    const clips = (element: Element) =>
      ["auto", "scroll", "hidden", "clip"].includes(window.getComputedStyle(element).overflowX);
    const sticksOut = (element: Element) => {
      if (element.getBoundingClientRect().right <= width + 1) return false;
      for (let parent = element.parentElement; parent && parent !== document.body;) {
        if (clips(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    };
    const wide = [...document.querySelectorAll("body *")].find(sticksOut);
    const where = wide
      ? `<${wide.tagName.toLowerCase()} class="${wide.getAttribute("class")?.slice(0, 100) ?? ""}">`
      : "?";
    return `${String(extra)} px (${where})`;
  });
}

/**
 * The screen a test ended on, checked as it is and in the variants its surface owes (T004,
 * research R9, SC-004, FR-012): dark on panel and public pages, 390 px on courier and public
 * pages, 1024 and 360 px on panel pages, never scrolling sideways at those widths. Then, at
 * the test's own size, no internal identifier on screen (T003, SC-005).
 */
async function checkScreen(page: Page): Promise<void> {
  const url = page.url();
  const surface = surfaceOf(url);
  const problems = await accessibilityViolations(page);
  if (surface !== "courier") {
    const previous = await page.evaluate(() => {
      const value = document.documentElement.getAttribute("data-scheme");
      document.documentElement.setAttribute("data-scheme", "dark");
      return value;
    });
    problems.push(...(await accessibilityViolations(page)).map((found) => `dark: ${found}`));
    await page.evaluate((value) => {
      if (value === null) document.documentElement.removeAttribute("data-scheme");
      else document.documentElement.setAttribute("data-scheme", value);
    }, previous);
  }
  const size = page.viewportSize();
  for (const width of surface === "panel" ? [1024, 360] : [390]) {
    await page.setViewportSize({ width, height: size?.height ?? 900 });
    const at = `${String(width)} px`;
    problems.push(...(await accessibilityViolations(page)).map((found) => `${at}: ${found}`));
    const overflow = await sidewaysScroll(page);
    if (overflow) problems.push(`${at}: the page scrolls sideways by ${overflow}`);
  }
  if (size) await page.setViewportSize(size);
  expect(problems, `accessibility of ${url}`).toEqual([]);
  expect(await visibleIdentifiers(page), `identifiers shown on ${url}`).toEqual([]);
}

/**
 * A page signed in as a role. When the test passed, the screen it ended on is checked, so
 * every end-to-end scenario also checks its screens.
 */
async function rolePage(browser: Browser, role: Role, use: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ storageState: authFile(role) });
  const page = await context.newPage();
  await use(page);
  if (endedOnScreen(page)) await checkScreen(page);
  await context.close();
}

/** Pages signed in as each role, and control of the server's clock. */
export const test = base.extend<{
  ownerPage: Page;
  dispatcherPage: Page;
  courierPage: Page;
  setServerNow: (instant: string) => Promise<void>;
}>({
  // The signed-out page (public pages, sign-in) is checked the same way.
  page: async ({ page }, use) => {
    await use(page);
    if (endedOnScreen(page)) await checkScreen(page);
  },
  ownerPage: async ({ browser }, use) => {
    await rolePage(browser, "owner", use);
  },
  dispatcherPage: async ({ browser }, use) => {
    await rolePage(browser, "dispatcher", use);
  },
  courierPage: async ({ browser }, use) => {
    await rolePage(browser, "courier", use);
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures destructure their dependencies.
  setServerNow: async ({}, use) => {
    await use(async (instant) => {
      await fetch(`http://127.0.0.1:${String(apiPort)}/api/test/clock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ now: instant }),
      });
    });
  },
});

export { expect };
