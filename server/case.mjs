// Server-only case truth. Never import this module into a browser bundle.
export const CASE_ID = "last-transmission-v1";
export const roles = ["archivist", "operator"];
export const sources = [
  { title: "NASA: Voyager 1", url: "https://science.nasa.gov/mission/voyager/voyager-1/", launchDate: "1977-09-05" },
  { title: "NASA: Voyager 2", url: "https://science.nasa.gov/mission/voyager/voyager-2/", launchDate: "1977-08-20" },
];
export const clues = {
  archivist: {
    id: "launch-manifest",
    title: "The launch manifest",
    kind: "historical-facts",
    text: "Voyager 1 launched on September 5, 1977. Voyager 2 launched on August 20, 1977. Match the dispatch to its mission and ISO launch date.",
    sources,
  },
  operator: {
    id: "routing-note",
    title: "The operator's routing note",
    kind: "fictional-clue",
    text: "The dispatch belongs to whichever Voyager left Earth first. Mission numbers are not launch order. Ask your archivist for the launch manifest; submit the mission and YYYY-MM-DD date together.",
    sources: [],
  },
};
export const solution = { mission: "voyager2", launchDate: "1977-08-20" };
