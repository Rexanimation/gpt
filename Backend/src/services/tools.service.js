
const axios = require('axios');

const TOOLS = [
    {
        type: "function",
        function: {
            name: "get_current_weather",
            description: "Get the current weather for a location",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "The city and country, e.g., 'San Francisco, US'"
                    }
                },
                required: ["location"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_current_time",
            description: "Get the current time and date",
            parameters: {
                type: "object",
                properties: {
                    timezone: {
                        type: "string",
                        description: "Timezone, e.g., 'America/New_York' (optional, defaults to UTC)"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_web",
            description: "Search the web for current information",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query"
                    }
                },
                required: ["query"]
            }
        }
    }
];

async function executeTool(toolName, args) {
    switch (toolName) {
        case "get_current_weather":
            return await getCurrentWeather(args.location);
        case "get_current_time":
            return await getCurrentTime(args.timezone);
        case "search_web":
            return await searchWeb(args.query);
        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

async function getCurrentWeather(location) {
    try {
        const response = await axios.get('https://wttr.in/' + encodeURIComponent(location) + '?format=j1');
        const data = response.data;
        const current = data.current_condition[0];
        return {
            location: data.nearest_area[0].areaName[0].value + ', ' + data.nearest_area[0].country[0].value,
            temperature: current.temp_C + '°C (' + current.temp_F + '°F)',
            condition: current.weatherDesc[0].value,
            humidity: current.humidity + '%',
            wind: current.windspeedKmph + ' km/h'
        };
    } catch (error) {
        return { error: 'Could not fetch weather data for ' + location };
    }
}

async function getCurrentTime(timezone) {
    const now = new Date();
    return {
        current_time: now.toISOString(),
        local_time: timezone ? now.toLocaleString('en-US', { timeZone: timezone }) : now.toLocaleString(),
        timezone: timezone || 'UTC'
    };
}

async function searchWeb(query) {
    try {
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                skip_disambig: 1
            }
        });
        const data = response.data;
        return {
            query: query,
            abstract: data.Abstract,
            abstract_source: data.AbstractSource,
            abstract_url: data.AbstractURL,
            related_topics: data.RelatedTopics ? data.RelatedTopics.slice(0, 5).map(t => t.Text) : []
        };
    } catch (error) {
        return { error: 'Could not perform web search' };
    }
}

module.exports = { TOOLS, executeTool };
