import { useEffect, useMemo, useState } from "react";

const screens = {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
};

/**
 * Checks whether a particular Tailwind CSS viewport size applies.
 *
 * @param size The size to check, which must either be included in Tailwind CSS's
 * list of default screen sizes, or added to the Tailwind CSS config file.
 *
 * @returns A boolean indicating whether the viewport size applies.
 */
export const useBreakpoint = (size: "sm" | "md" | "lg" | "xl" | "2xl") => {
    const mediaQuery = useMemo(() => typeof window !== "undefined" ? window.matchMedia(`(min-width: ${screens[size]})`) : null, [size]);
    const [matches, setMatches] = useState(mediaQuery?.matches ?? true);

    useEffect(() => {
        if (!mediaQuery) return;

        const updateMatch = (value: MediaQueryList | MediaQueryListEvent) => setMatches(value.matches);
        updateMatch(mediaQuery);

        const handleChange = (event: MediaQueryListEvent) => updateMatch(event);

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [mediaQuery]);

    return matches;
};
