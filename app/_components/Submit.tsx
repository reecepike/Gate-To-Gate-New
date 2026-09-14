'use client';

import { useFormStatus } from 'react-dom';
import { useLinkStatus } from 'next/link';

/**
 * Buttons and links that admit they are doing something.
 *
 * A server action on a slow connection looks identical to a dead button: you
 * tap, nothing changes, so you tap again — and on the day planner that meant
 * ticking something off twice. The fix is not faster servers, it is telling the
 * truth about what is happening, immediately, on the tap.
 *
 * `useFormStatus` has to be read from inside the form, which is why this is its
 * own component rather than a prop on the page.
 */
export function Submit({
  children,
  className = '',
  busyLabel,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  busyLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${className} ${pending ? 'busy' : ''}`.trim()}
      disabled={pending}
      aria-busy={pending}
      title={title}
    >
      {pending && <span className="spin" aria-hidden="true" />}
      <span>{pending ? (busyLabel ?? children) : children}</span>
    </button>
  );
}

/**
 * The bar that appears under a link while the next page is being fetched.
 *
 * Next only tells you a navigation is pending from inside the Link, so this
 * renders as a Link child and paints itself across the top of the screen.
 */
export function LinkSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <span className="route-bar" aria-hidden="true" /> : null;
}

export default Submit;
