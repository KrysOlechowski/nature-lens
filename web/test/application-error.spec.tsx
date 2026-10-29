import {
  Children,
  isValidElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ApplicationError from "../app/error";
import { Button } from "../components/ui/button";

interface ElementProps {
  children?: ReactNode;
  onClick?: () => void;
}

describe("application error fallback", () => {
  it("hides technical details and retries the failed route tree", () => {
    const reset = vi.fn();
    const error = Object.assign(
      new Error("provider payload must stay private"),
      { digest: "private-digest" },
    );
    const fallback = ApplicationError({ error, reset });
    const markup = renderToStaticMarkup(fallback);
    const retryButton = findElement(fallback, Button);

    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Try again");
    expect(markup).not.toContain(error.message);
    expect(markup).not.toContain(error.digest);

    expect(retryButton).toBeDefined();
    retryButton?.props.onClick?.();
    expect(reset).toHaveBeenCalledOnce();
  });
});

function findElement(
  node: ReactNode,
  type: ComponentType,
): ReactElement<ElementProps> | undefined {
  if (!isValidElement<ElementProps>(node)) {
    return undefined;
  }

  if (node.type === type) {
    return node;
  }

  for (const child of Children.toArray(node.props.children)) {
    const match = findElement(child, type);

    if (match) {
      return match;
    }
  }

  return undefined;
}
