// The personalized part of the Home screen. Everything else on Home is fixed text and links.
// There is no backend endpoint for this yet; see homeService.ts.
export type HomeSummary = {
  // Today's date as "YYYY-MM-DD". The screen turns it into "TUESDAY, NOVEMBER 17".
  today: string;
  // Big text on the maroon card, e.g. "A good day to get connected."
  heroTitle: string;
};
