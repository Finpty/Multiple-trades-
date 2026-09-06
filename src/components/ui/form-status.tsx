"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./index";

/** Submit button that reflects pending state of the surrounding <form action>. */
export function SubmitButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText ?? "Saving…" : children}
    </Button>
  );
}
