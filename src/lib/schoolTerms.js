// National public school terms (one calendar for all provinces since 2026), from the gazetted
// DBE calendars. Independent/IEB schools set their own dates. Check the gazette each year and add new years here.
export const SA_PUBLIC_TERMS = {
  2026: [
    ['Term 1', '2026-01-14', '2026-03-27'],
    ['Term 2', '2026-04-08', '2026-06-26'],
    ['Term 3', '2026-07-21', '2026-09-23'],
    ['Term 4', '2026-10-06', '2026-12-09'],
  ],
  2027: [
    ['Term 1', '2027-01-13', '2027-03-19'],
    ['Term 2', '2027-04-06', '2027-06-25'],
    ['Term 3', '2027-07-20', '2027-09-22'],
    ['Term 4', '2027-10-05', '2027-12-08'],
  ],
};
export const termYears = () => Object.keys(SA_PUBLIC_TERMS).map(Number);
