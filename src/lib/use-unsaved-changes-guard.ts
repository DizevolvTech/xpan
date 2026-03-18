"use client";

import { useCallback, useEffect } from "react";

type UseUnsavedChangesGuardOptions = {
  enabled?: boolean;
  isDirty: boolean;
  message?: string;
  onDiscard?: () => void;
};

const defaultMessage = "Existem alterações não salvas. Deseja sair mesmo assim?";

export function useUnsavedChangesGuard({
  enabled = true,
  isDirty,
  message = defaultMessage,
  onDiscard,
}: UseUnsavedChangesGuardOptions) {
  const confirmIfNeeded = useCallback(() => {
    if (!enabled || !isDirty) {
      return true;
    }

    const confirmed = window.confirm(message);
    if (confirmed) {
      onDiscard?.();
    }

    return confirmed;
  }, [enabled, isDirty, message, onDiscard]);

  useEffect(() => {
    if (!enabled || !isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, isDirty, message]);

  useEffect(() => {
    if (!enabled || !isDirty) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const isInternalNavigation = nextUrl.origin === currentUrl.origin;
      const isSameLocation =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;

      if (!isInternalNavigation || isSameLocation) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        onDiscard?.();
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [enabled, isDirty, message, onDiscard]);

  return {
    confirmIfNeeded,
    shouldWarn: enabled && isDirty,
  };
}
