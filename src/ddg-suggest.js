/**
 * Converts suggestion phrases into Alfred-compatible JSON items
 * @param {string[]} itemNames - Array of suggestion phrases
 * @returns {Object[]} Array of Alfred item objects
 */
function makeItems(itemNames) {
	return itemNames
		.filter((name) => name && name.trim())
		.map((name) => ({
			uid: name,
			title: name,
			subtitle: `Search "${name}" on DuckDuckGo`,
			autocomplete: name,
			arg: name,
			valid: true,
		}));
}

/**
 * Fetches autocomplete suggestions from DuckDuckGo API
 * @param {string} query - The search query
 * @returns {string[]} Array of suggestion phrases
 */
function fetchSuggestions(query) {
	const encodedQuery = encodeURIComponent(query);
	const apiURL = `https://duckduckgo.com/ac/?q=${encodedQuery}&kl=wt-wt`;
	const url = $.NSURL.URLWithString(apiURL);

	try {
		const data = $.NSData.dataWithContentsOfURL(url);

		if (!data || data.length === 0) {
			return [];
		}

		const jsonString = $.NSString.alloc.initWithDataEncoding(
			data,
			$.NSUTF8StringEncoding
		).js;

		return JSON.parse(jsonString || "[]")
			.map((item) => item?.phrase)
			.filter((phrase) => phrase && phrase.trim() && phrase !== query);
	} catch (e) {
		return [];
	}
}

// Pre-load environment variables (Google strategy: avoid repeated lookups)
const oldArg =
	$.NSProcessInfo.processInfo.environment.objectForKey("oldArg")?.js || "";
const oldResults =
	$.NSProcessInfo.processInfo.environment.objectForKey("oldResults")?.js ||
	"";

/**
 * Main Alfred Script Filter entry point with aggressive caching strategy
 * @param {string[]} argv - Command line arguments (query)
 * @returns {string} JSON string for Alfred Script Filter
 */
function run(argv) {
	const query = argv[0]?.trim();

	if (!query) {
		return JSON.stringify({
			items: [
				{
					title: "Start typing to search...",
					subtitle: "DuckDuckGo suggestions will appear",
					valid: false,
				},
			],
		});
	}

	// Fast path: User is still typing, return cached results immediately
	if (query !== oldArg) {
		const cachedSuggestions = oldResults
			? oldResults.split("\n").filter(Boolean)
			: [];

		return JSON.stringify({
			rerun: 0.1,
			skipknowledge: true,
			variables: {
				oldResults: oldResults,
				oldArg: query,
			},
			items: makeItems([query].concat(cachedSuggestions)),
		});
	}

	// Slow path: Fetch fresh suggestions from API (only when user pauses typing)
	const freshSuggestions = fetchSuggestions(query);

	return JSON.stringify({
		skipknowledge: true,
		variables: {
			oldResults: freshSuggestions.join("\n"),
			oldArg: query,
		},
		items: makeItems([query].concat(freshSuggestions)),
	});
}
