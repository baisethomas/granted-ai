# Finding Your Already-Forwarded Port

## Situation
Cursor says port 5000 "may already be forwarded" - this means it's likely already set up, you just need to find the URL!

## How to Find Your Forwarded Port URL

### Method 1: Check Command Palette for Port List
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `port list` or `ports: show`
3. Look for port 5000 in the list
4. Click on it to see the forwarded URL

### Method 2: Check Terminal Panel
1. Look at the bottom panel where your terminal is
2. Check if there are multiple tabs (Terminal, Problems, Output, **Ports**)
3. Click on the "Ports" tab if it exists
4. You should see port 5000 listed with a URL

### Method 3: Check Status Bar
1. Look at the very bottom-right of Cursor window
2. There might be a port indicator showing "5000" or similar
3. Click on it to see forwarding details

### Method 4: Check Notifications
1. Look for a notification icon (usually bottom-right)
2. Check if there are any port forwarding notifications
3. They might contain the URL

### Method 5: Try Common Cursor URLs
If port 5000 is forwarded, try accessing:
- Check your Cursor window title or status - it might show a URL
- Look for any "Open in Browser" buttons in the UI
- Check if there's a preview pane or browser preview option

### Method 6: Use a Different Port
If you can't find the forwarded URL, let's use a port that's definitely available:

```bash
# Stop current server
pkill -f "tsx.*server/index"

# Start on a different port (like 3000)
PORT=3000 npm run dev
```

Then try forwarding port 3000 instead.

## Quick Test
The server IS running and working. Test with:
```bash
curl http://localhost:5000/api/health
```

This confirms the server is fine - we just need to find Cursor's forwarded URL for it.

## What the URL Looks Like
Cursor forwarded URLs typically look like:
- `https://[random-id]-5000.[domain].app`
- `https://[workspace]-5000.cursor.sh`
- Or similar patterns

## Next Steps
1. Try Method 1 (Command Palette → port list) - most likely to work
2. If that doesn't work, try Method 2 (check for Ports tab)
3. As last resort, use a different port (Method 6)
