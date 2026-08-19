import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PrivacyContextType {
  hidden: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  hidden: false,
  toggle: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const toggle = useCallback(() => setHidden((h) => !h), []);
  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
