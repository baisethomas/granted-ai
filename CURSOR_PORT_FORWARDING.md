# Cursor Remote Development - Port Forwarding Guide

## Issue
Getting 403 error when accessing `localhost:5000` or `127.0.0.1:5000` in browser.

## Root Cause
Cursor remote environments block direct browser access to localhost. You need to use port forwarding.

## Solution: Use Cursor's Port Forwarding

### Step 1: Open Ports Tab
1. Look at the bottom of your Cursor window
2. Click on the **"Ports"** tab (or look for a "PORTS" section)
3. You should see a list of ports

### Step 2: Find Port 5000
- Look for port `5000` in the list
- If it's not there, it may be auto-detected when the server starts

### Step 3: Make Port Public/Accessible
1. **Right-click** on port 5000
2. Select **"Open in Browser"** or **"Make Public"**
3. This will give you a URL like: `https://xxxxx-5000.xxxxx.app` or similar

### Step 4: Access Your Application
- Use the URL provided by Cursor (NOT localhost)
- This URL will forward to your server on port 5000

## Alternative: Manual Port Forwarding

If the Ports tab doesn't work:

1. **Check Cursor Settings:**
   - Go to Settings → Port Forwarding
   - Add port 5000
   - Set visibility to "Public" or "Private"

2. **Use the Forwarded URL:**
   - Cursor will provide a URL like: `https://[random-id]-5000.[domain]`
   - Use this URL in your browser

## Verify Server is Running

The server IS running correctly. You can verify with:

```bash
curl http://localhost:5000/api/health
```

This should return:
```json
{"status":"ok","timestamp":"...","database":"...","supabase":"...","storage":"..."}
```

## Why This Happens

- Cursor runs your code in a remote container
- Browser security prevents accessing `localhost` from your local machine
- Port forwarding creates a secure tunnel from Cursor's servers to your container
- This is normal and expected behavior in remote development environments

## Quick Test

1. Server is running ✅ (verified with curl)
2. Open Cursor's Ports tab
3. Find port 5000
4. Click "Open in Browser"
5. Use the provided URL (NOT localhost)

## Still Having Issues?

If port forwarding doesn't work:
1. Check Cursor documentation for your specific version
2. Try restarting Cursor
3. Check if there are firewall rules blocking port 5000
4. Verify the server is actually listening: `lsof -i :5000` or `ss -tlnp | grep 5000`
