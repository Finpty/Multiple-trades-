"use client";

import * as React from "react";
import { Button } from "./index";

/** Submit button that asks for confirmation before submitting its form. */
export function ConfirmButton({ confirm, children, ...props }: React.ComponentProps<typeof Button> & { confirm: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
        props.onClick?.(e);
      }}
    >
      {children}
    </Button>
  );
}
