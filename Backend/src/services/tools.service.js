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
    },
    {
        type: "function",
        function: {
            name: "get_stock_data",
            description: "Get current stock data including price, open, close, high, low, and volume",
            parameters: {
                type: "object",
                properties: {
                    symbol: {
                        type: "string",
                        description: "Stock ticker symbol, e.g., 'AAPL' for Apple, 'GOOGL' for Google"
                    }
                },
                required: ["symbol"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_stock_news",
            description: "Get recent news articles related to a stock or company",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Stock symbol or company name, e.g., 'AAPL' or 'Apple Inc'"
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
        case "get_stock_data":
            return await getStockData(args.symbol);
        case "get_stock_news":
            return await getStockNews(args.query);
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

async function getStockData(symbol) {
    try {
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`, {
            params: {
                interval: '1d',
                range: '5d'
            }
        });
        const result = response.data.chart.result[0];
        const meta = result.meta;
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];
        
        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        const historicalData = timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toLocaleDateString(),
            open: indicators.open[i],
            high: indicators.high[i],
            low: indicators.low[i],
            close: indicators.close[i],
            volume: indicators.volume[i]
        })).filter(d => d.close);

        return {
            symbol: meta.symbol,
            company_name: meta.shortName,
            currency: meta.currency,
            current_price: currentPrice,
            previous_close: previousClose,
            change: change.toFixed(2),
            change_percent: changePercent.toFixed(2) + '%',
            market_open: meta.tradingPeriods ? 'Open' : 'Closed',
            historical_data: historicalData.slice(-5),
            chart_data_url: `https://finance.yahoo.com/chart/${symbol.toUpperCase()}`,
            note: 'For detailed charts, visit the Yahoo Finance URL provided'
        };
    } catch (error) {
        return { 
            error: 'Could not fetch stock data for ' + symbol,
            suggestion: 'Please check if the stock symbol is correct (e.g., AAPL, GOOGL, MSFT)'
        };
    }
}

async function getStockNews(query) {
    try {
        const searchQuery = `${query} stock market news`;
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: searchQuery,
                format: 'json',
                no_html: 1,
                skip_disambig: 1
            }
        });
        const data = response.data;
        
        const newsFromWeb = await searchWeb(searchQuery);
        
        return {
            query: query,
            summary: data.Abstract || 'Latest news and updates for ' + query,
            related_news: data.RelatedTopics ? data.RelatedTopics.slice(0, 8).map(t => ({
                title: t.Text,
                url: t.FirstURL
            })) : [],
            additional_info: newsFromWeb,
            note: 'For more comprehensive news, consider searching financial news websites directly'
        };
    } catch (error) {
        return { error: 'Could not fetch stock news for ' + query };
    }
}

module.exports = { TOOLS, executeTool };
