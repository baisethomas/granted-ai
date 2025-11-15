# Accessing Your Server in Cursor

## Current Situation
- Server is running correctly on port 5000 ✅
- Cursor environment expects port 26053 (from `$PORT` env var)
- Browser access to localhost is blocked (normal for remote environments)

## Solution Options

### Option 1: Run Server on Cursor's Expected Port (Recommended)

Cursor may automatically forward the port specified in `$PORT` environment variable:

```bash
# Stop current server, then:
npm run dev
# This will use PORT=26053 automatically
```

Then try accessing via the URL Cursor provides (check terminal output or Cursor's UI).

### Option 2: Find Port Forwarding in Cursor UI

Look for port forwarding in these locations:

1. **Command Palette:**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "port" or "forward"
   - Look for "Ports: Focus on Ports View" or similar

2. **Terminal Panel:**
   - Check if there's a "Ports" section in the terminal area
   - Look for tabs like "Terminal", "Problems", "Ports"

3. **Status Bar:**
   - Bottom right corner of Cursor
   - May show port forwarding status

4. **Settings:**
   - Go to Settings → Search for "port"
   - Check "Remote" or "Port Forwarding" settings

### Option 3: Use Cursor's Built-in Browser Preview

Some Cursor versions have a preview feature:
- Look for a "Preview" or "Open Preview" button
- Or right-click on `client/index.html` → "Open Preview"
- This might automatically handle port forwarding

### Option 4: Check Terminal Output

When you run `npm run dev`, Cursor might print a URL:
- Look for messages like "Local: http://localhost:5000"
- Or "On Your Network: http://..."
- Cursor might provide a forwarded URL automatically

### Option 5: Manual Port Configuration

If you can find Cursor's port forwarding settings:
1. Add port 5000 manually
2. Set it to "Public" or "Open in Browser"
3. Use the generated URL

## Quick Test

The server IS working. Test with:

```bash
curl http://localhost:5000/api/health
```

This confirms the server is running correctly.

## Alternative: Use the Expected Port

Since `$PORT=26053`, try:

```bash
# The server code uses process.env.PORT || '5000'
# So if PORT is set to 26053, it should use that
PORT=26053 npm run dev
```

Then check if Cursor automatically provides access to that port.

## Still Stuck?

1. **Check Cursor Documentation** - Look up "port forwarding" for your Cursor version
2. **Try Command Palette** - `Cmd/Ctrl+Shift+P` → search "port"
3. **Check Terminal** - Look for any URLs or port information when server starts
4. **Cursor Version** - Some features vary by version

The server is working perfectly - we just need to find how Cursor exposes it to your browser!
