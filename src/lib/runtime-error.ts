/** İsteğe bağlı host telemetri kancaları (varsa sessizce iletir). */

type CaptureOptions = {
  forceToast?: boolean;
  silent?: boolean;
};

type HostEvents = {
  captureException?: (
    error: Error,
    hint?: Record<string, unknown>,
    options?: CaptureOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: HostEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
      lineno?: number;
      colno?: number;
    }) => void;
  }
}

export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error));

  if (typeof window === "undefined") return;

  window.__lovableEvents?.captureException?.(err, { contexts: { react: context } }, { silent: true });

  // Bazı host ortamları Response fırlatmalarını yakalamaz; kanca varsa ilet.
  const isResponse =
    typeof Response !== "undefined" &&
    (error instanceof Response ||
      (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "headers" in error &&
        "url" in error));

  if (!isResponse) return;

  const res = error as Response;
  window.__lovableReportRuntimeError?.({
    message: `Response ${res.status} ${res.statusText || ""}`.trim(),
    stack: err.stack,
    filename: res.url || undefined,
  });
}
