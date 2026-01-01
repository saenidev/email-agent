"use client";

import { useState, useCallback, useMemo } from "react";

interface Email {
  id: string;
}

export function useEmailSelection<T extends Email>(emails: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleEmail = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(emails.map((e) => e.id)));
  }, [emails]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const allSelected = useMemo(
    () => emails.length > 0 && selectedIds.size === emails.length,
    [emails.length, selectedIds.size]
  );

  const selectedEmailIds = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds: selectedEmailIds,
    selectedCount,
    allSelected,
    toggleEmail,
    selectAll,
    deselectAll,
    isSelected,
    clearSelection: deselectAll,
  };
}
