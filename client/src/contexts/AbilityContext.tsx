import React, { useMemo, createContext, useContext } from 'react';
import { createContextualCan } from '@casl/react';
import { buildAbility, AppAbility } from '@/lib/ability';
import { useAuthStore } from '@/stores/auth.store';

export const AbilityContext = createContext<AppAbility>(buildAbility([]));
export const Can = createContextualCan(AbilityContext.Consumer);

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const permissions = useAuthStore((s) => s.permissions);
  const ability = useMemo(() => buildAbility(permissions || []), [permissions]);
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};

export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

/**
 * Convenience hook — check permission by key (e.g. "customer.create").
 * Preferred over direct ability.can() in most component code for brevity.
 */
export function usePermission(key: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return (permissions || []).includes(key);
}

/**
 * Convenience hook — check ability by (action, subject) pair directly.
 */
export function useCan(action: string, subject: string): boolean {
  const ability = useAbility();
  return ability.can(action, subject);
}
