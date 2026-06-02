/**
 * Generate a readable DRM ID in format: PK-BILA-1234
 * - Country code (2 chars, uppercase)
 * - Name part (up to 4 chars, uppercase, from company name initials or first chars)
 * - Unique 4-digit number derived from UUID
 * 
 * Supports both 3-arg and 4-arg calling conventions for backward compatibility.
 */
export function generateDrmId(
    companyName: string,
    country: string,
    fallbackIdOrPersonName: string,
    fallbackId?: string
): string {
    // Support both (company, country, fallback) and (company, country, personName, fallback)
    const actualFallbackId = fallbackId ?? fallbackIdOrPersonName;

    // 1. Get Country Code (2 chars UPPERCASE, e.g. "PK")
    let countryCode = "OT";
    if (country) {
        const c = country.trim().toLowerCase();
        if (c === "pakistan" || c === "pk") {
            countryCode = "PK";
        } else if (c === "united arab emirates" || c === "uae") {
            countryCode = "AE";
        } else if (c === "usa" || c === "united states" || c === "us") {
            countryCode = "US";
        } else if (c === "uk" || c === "united kingdom") {
            countryCode = "UK";
        } else if (c === "china" || c === "cn") {
            countryCode = "CN";
        } else if (c === "india" || c === "in") {
            countryCode = "IN";
        } else if (c === "saudi arabia" || c === "sa") {
            countryCode = "SA";
        } else if (c.length >= 2) {
            countryCode = c.substring(0, 2).toUpperCase();
        } else if (c.length === 1) {
            countryCode = (c + "X").toUpperCase();
        }
    }

    // 2. Get Name Part (up to 4 chars UPPERCASE from Company name)
    let namePart = "COMP";
    const entityName = (companyName || "UNKNOWN").trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "");
    const words = entityName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        namePart = words
            .map((w) => w[0])
            .join("")
            .substring(0, 4);
    } else if (words.length === 1) {
        namePart = words[0].substring(0, 4);
    }

    // 3. Unique Number (4 digits from UUID hex)
    const hexPart = (actualFallbackId || "").replace(/-/g, "").substring(0, 6);
    const num = parseInt(hexPart, 16);
    const uniqueNum = String(isNaN(num) ? Math.floor(Math.random() * 10000) : (num % 10000)).padStart(4, "0");

    // Format: pkbila1234 (no dashes, lowercase)
    return `${countryCode.toLowerCase()}${namePart.toLowerCase()}${uniqueNum}`;
}
