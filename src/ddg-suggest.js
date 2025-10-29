/**
 * Converts suggestion phrases into Alfred-compatible JSON items
 * @param {string[]} itemNames - Array of suggestion phrases
 * @returns {Object[]} Array of Alfred item objects
 */
function makeItems(itemNames) {
	return itemNames
		.filter(name => name && name.trim())
		.map(name => ({
			uid: name,
			title: name,
			subtitle: `Search "${name}" on DuckDuckGo`,
			autocomplete: name,
			arg: name
		}))
}

/**
 * Fetches autocomplete suggestions from DuckDuckGo API
 * @param {string} query - The search query
 * @returns {string[]} Array of suggestion phrases
 */
function fetchSuggestions(query) {
	const encodedQuery = encodeURIComponent(query)
	const apiURL = `https://duckduckgo.com/ac/?q=${encodedQuery}&kl=wt-wt`

	const task = $.NSTask.alloc.init
	task.launchPath = "/usr/bin/curl"
	task.arguments = ["-s", "-m", "2", apiURL]

	const pipe = $.NSPipe.pipe
	task.standardOutput = pipe
	task.standardError = $.NSPipe.pipe

	task.launch
	task.waitUntilExit

	if (task.terminationStatus !== 0) return []

	const data = pipe.fileHandleForReading.readDataToEndOfFile
	const response = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js

	try {
		return JSON.parse(response || "[]")
			.map(item => item?.phrase)
			.filter(phrase => phrase && phrase !== query)
	} catch (e) {
		return []
	}
}

/**
 * Main Alfred Script Filter entry point
 * Implements caching strategy for instant UI response
 * @param {string[]} argv - Command line arguments (query)
 * @returns {string} JSON string for Alfred Script Filter
 */
function run(argv) {
	const query = argv[0]
	const oldArg = $.NSProcessInfo.processInfo.environment.objectForKey("oldArg")?.js
	const oldResults = $.NSProcessInfo.processInfo.environment.objectForKey("oldResults")?.js

	if (query !== oldArg) {
		const cachedResults = oldResults ? oldResults.split("\n").filter(Boolean) : []

		return JSON.stringify({
			rerun: 0.1,
			skipknowledge: true,
			variables: {
				oldResults: oldResults || "",
				oldArg: query
			},
			items: makeItems([query, ...cachedResults])
		})
	}

	const suggestions = fetchSuggestions(query)

	return JSON.stringify({
		skipknowledge: true,
		variables: {
			oldResults: suggestions.join("\n"),
			oldArg: query
		},
		items: makeItems([query, ...suggestions])
	})
}
