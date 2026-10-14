import type { ReactElement } from "react";

declare global {
  // React 19 types no longer ship a global JSX namespace; restore it
  // so `: JSX.Element` return annotations keep working.
  namespace JSX {
    type Element = ReactElement;
  }
}

export {};
