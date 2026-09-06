/**
 * Static option lists for the wizard. These are generic reference data
 * (IANA zones, ISO currencies, Google font names) — never business content.
 */
export const TIMEZONES = [
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Hobart",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "UTC",
];

export const CURRENCIES: Array<{ code: string; label: string }> = [
  { code: "AUD", label: "AUD — Australian dollar" },
  { code: "NZD", label: "NZD — New Zealand dollar" },
  { code: "USD", label: "USD — US dollar" },
  { code: "CAD", label: "CAD — Canadian dollar" },
  { code: "GBP", label: "GBP — British pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "SGD", label: "SGD — Singapore dollar" },
  { code: "MYR", label: "MYR — Malaysian ringgit" },
  { code: "IDR", label: "IDR — Indonesian rupiah" },
  { code: "PHP", label: "PHP — Philippine peso" },
  { code: "HKD", label: "HKD — Hong Kong dollar" },
  { code: "JPY", label: "JPY — Japanese yen" },
  { code: "AED", label: "AED — UAE dirham" },
  { code: "INR", label: "INR — Indian rupee" },
  { code: "ZAR", label: "ZAR — South African rand" },
  { code: "BRL", label: "BRL — Brazilian real" },
  { code: "MXN", label: "MXN — Mexican peso" },
  { code: "CHF", label: "CHF — Swiss franc" },
  { code: "SEK", label: "SEK — Swedish krona" },
];

export const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "SG", label: "Singapore" },
  { code: "MY", label: "Malaysia" },
  { code: "ID", label: "Indonesia" },
  { code: "PH", label: "Philippines" },
  { code: "HK", label: "Hong Kong" },
  { code: "JP", label: "Japan" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "IN", label: "India" },
  { code: "ZA", label: "South Africa" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
];

export const LOCALES = ["en-AU", "en-NZ", "en-US", "en-GB", "en-CA", "en-IE", "en-SG", "en-IN", "en-ZA", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL", "sv-SE", "pt-BR", "ja-JP", "ms-MY", "id-ID"];

export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Work Sans",
  "DM Sans",
  "Manrope",
  "Source Sans 3",
  "Space Grotesk",
  "Plus Jakarta Sans",
  "Outfit",
  "Raleway",
  "Oswald",
  "Archivo Black",
  "Bebas Neue",
  "Playfair Display",
  "Libre Baskerville",
  "Cormorant Garamond",
  "Fraunces",
  "Merriweather",
  "Lora",
  "EB Garamond",
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export const PRICING_METHODS: Array<{ value: string; label: string }> = [
  { value: "QUOTE", label: "Quote on request" },
  { value: "FIXED", label: "Fixed price" },
  { value: "RANGE", label: "Price range" },
  { value: "HOURLY", label: "Hourly rate" },
  { value: "DAY_RATE", label: "Day rate" },
  { value: "PER_SQM", label: "Per square metre" },
  { value: "PER_UNIT", label: "Per unit" },
  { value: "PER_LINEAR_METRE", label: "Per linear metre" },
];

export const PRICING_ITEM_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: "RATE", label: "Rate", hint: "Amount per unit (hour, m², item)" },
  { value: "FEE", label: "Fee", hint: "Flat amount added once" },
  { value: "MULTIPLIER", label: "Multiplier", hint: "Scales a variable (1.25 = +25%)" },
  { value: "PERCENT", label: "Percent", hint: "Percentage of a subtotal" },
];

export const AREA_TYPES: Array<{ value: string; label: string }> = [
  { value: "COUNTRY", label: "Country" },
  { value: "STATE", label: "State" },
  { value: "REGION", label: "Region" },
  { value: "CITY", label: "City" },
  { value: "SUBURB", label: "Suburb" },
  { value: "POSTCODE", label: "Postcode" },
];

export const THEME_ENUMS = {
  radius: ["none", "sm", "md", "lg", "xl"],
  buttonStyle: ["solid", "outline", "pill", "ghost"],
  borderStyle: ["none", "subtle", "strong"],
  imageStyle: ["natural", "warm", "cinematic", "muted", "duotone"],
  animation: ["none", "subtle", "medium", "bold"],
  mode: ["light", "dark"],
  spacing: ["compact", "comfortable", "spacious"],
  tone: ["professional", "friendly", "premium", "bold", "technical"],
} as const;

export const COLOR_KEYS: Array<{ key: "primary" | "secondary" | "accent" | "background" | "surface" | "text" | "muted" | "border"; label: string; hint: string }> = [
  { key: "primary", label: "Primary", hint: "Buttons, links, headings" },
  { key: "secondary", label: "Secondary", hint: "Supporting elements" },
  { key: "accent", label: "Accent", hint: "Highlights & calls to action" },
  { key: "background", label: "Background", hint: "Page background" },
  { key: "surface", label: "Surface", hint: "Cards & alternating sections" },
  { key: "text", label: "Text", hint: "Body copy" },
  { key: "muted", label: "Muted", hint: "Secondary text" },
  { key: "border", label: "Border", hint: "Dividers & outlines" },
];
