import { PostHog } from "posthog-node";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * Server-side PostHog wrapper
 * Uses Proxy to intercept all PostHog methods and handle errors gracefully
 */

// Initialize PostHog client singleton
const posthogClient = env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

if (!env.NEXT_PUBLIC_POSTHOG_ENABLED && posthogClient) {
  posthogClient.optOut();
}

/**
 * Create a proxy that wraps PostHog client methods
 * - Returns no-op functions if PostHog is not configured
 * - Adds error handling and logging to all methods
 * - Maintains the same API as PostHog client
 */
const posthog = new Proxy({} as PostHog, {
  get(_target, prop: string | symbol) {
    // If PostHog is not configured, every string property must still be a
    // callable no-op. `posthogClient` is null here, so checking its properties
    // would always be false and `posthog.capture` would be `undefined`; callers
    // using `posthog?.capture(...)` then throw even though `posthog` is truthy.
    // That used to break the sign-up `user.create.after` hook with a 422.
    if (!posthogClient) {
      return typeof prop === "string" ? () => Promise.resolve() : undefined;
    }

    const original = posthogClient[prop as keyof PostHog];

    // If it's not a function, return the property as-is
    if (typeof original !== "function") {
      return original;
    }

    // Wrap function calls with error handling and logging
    return (...args: unknown[]) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (original as any).apply(posthogClient, args);

        // Log the PostHog call
        logger.info("PostHog method called", {
          method: String(prop),
          args,
        });

        return result;
      } catch (error) {
        logger.error("PostHog method failed", {
          method: String(prop),
          error,
          args,
        });

        // Return a resolved promise for async methods to prevent errors
        return Promise.resolve();
      }
    };
  },
});

export { posthog };
