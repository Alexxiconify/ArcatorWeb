# Census Data System

This document explains how the census data system works for the Arcator website.

## Overview

The census data system has been updated to use a JSON file instead of direct Google Sheets integration. This provides
better performance, reliability, and eliminates CORS issues.

## Files

- `census-data.json` - The data file that contains community interests
- `update-census-data.js` - Server-side script to update the JSON file from Google Sheets
- `about.html` - Updated to load data from the JSON file

## How It Works

1. **Server-side**: The `update-census-data.js` script fetches data from Google Sheets and updates `census-data.json`
2. **Client-side**: The website loads data from `census-data.json` instead of directly from Google Sheets
3. **Auto-update**: The JSON file can be updated automatically using cron jobs or manual execution

## Setting Up Auto-Updates

### Option 1: Cron Job (Linux/Mac)

Add this to your crontab to update every hour:

```bash
0 * * * * cd /path/to/your/website && node update-census-data.js
```

### Option 2: Windows Task Scheduler

1. Open Task Scheduler
2. Create a new Basic Task
3. Set trigger to run every hour
4. Set action to run: `node update-census-data.js`
5. Set start in: `/path/to/your/website`

### Option 3: Manual Updates

Run the script manually when needed:

```bash
node update-census-data.js
```

## Configuration

You can configure the script using environment variables:

```bash
# Set custom Google Sheets URL
export GOOGLE_SHEETS_URL="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/gviz/tq?tqx=out:csv&gid=YOUR_GID"

# Set custom output file path
export OUTPUT_FILE="path/to/census-data.json"

# Run the script
node update-census-data.js
```

## Data Format

The `census-data.json` file has this structure:

```json
{
  "lastUpdated": "2024-01-15T12:00:00Z",
  "data": [
    {
      "interest": "Minecraft Building",
      "category": "Gaming",
      "members": 45,
      "description": "Creative building and redstone engineering"
    }
  ]
}
```

## Benefits

- ✅ **No CORS issues** - No need for proxy servers
- ✅ **Better performance** - Faster loading from local JSON
- ✅ **Reliable** - Works even if Google Sheets is temporarily unavailable
- ✅ **Auto-updatable** - Can be scheduled to update automatically
- ✅ **Fallback support** - Built-in fallback data if JSON file is unavailable

## Troubleshooting

### JSON file not found

- Ensure `census-data.json` exists in the website root
- Check file permissions
- Verify the file path in `about.html`

### Update script fails

- Check internet connection
- Verify Google Sheets URL is correct
- Ensure Node.js is installed
- Check file write permissions

### Data not updating

- Verify the cron job is running
- Check script logs for errors
- Ensure the Google Sheets URL is accessible

## Migration from Old System

The old Google Sheets integration has been removed from `about.html`. The new system:

1. Loads data from `census-data.json`
2. Shows fallback data if JSON is unavailable
3. Provides a link to view live data in Google Sheets
4. Maintains all existing functionality (search, filter, sort)

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify the JSON file exists and is valid
3. Test the update script manually
4. Check server logs for any errors
