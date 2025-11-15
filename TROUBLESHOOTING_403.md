# Troubleshooting 403 Error

## Issue
Getting "Access to localhost was denied - HTTP ERROR 403" when accessing the application in browser.

## Diagnosis

The server is running correctly on port 5000. The 403 error is likely coming from your hosting environment (proxy/firewall), not from the Express application itself.

## Solutions

### 1. Check Your Access Method

**If you're in a remote environment (Replit, Cursor, etc.):**
- Don't use `localhost` - use the public URL provided by your environment
- Look for a "Preview" or "Open in Browser" button in your IDE
- Check if your environment provides a public URL like `https://your-project.repl.co` or similar

**If you're accessing locally:**
- Make sure you're using `http://localhost:5000` (not https)
- Try `http://127.0.0.1:5000` instead

### 2. Verify Server is Running

```bash
# Check if server is listening
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","timestamp":"...","database":"...","supabase":"...","storage":"..."}
```

### 3. Check Browser Console

Open browser developer tools (F12) and check:
- Network tab for the actual HTTP status code
- Console for any JavaScript errors
- See if the request is being blocked before reaching the server

### 4. Environment-Specific Solutions

**Replit:**
- Use the "Open in Browser" button or the URL shown in the preview panel
- Don't use localhost - use the `.repl.co` URL

**Cursor/Remote Development:**
- Check if there's a port forwarding configuration
- Look for a "Ports" tab in your IDE
- May need to configure port forwarding for 5000

**Local Development:**
- Make sure no firewall is blocking port 5000
- Try a different browser
- Clear browser cache

### 5. Test Direct API Access

Try accessing the API directly:
```bash
# Health check (should work)
curl http://localhost:5000/api/health

# Root page
curl http://localhost:5000/
```

If these work via curl but not in browser, it's an environment/proxy issue.

### 6. Check Server Logs

```bash
# View server logs
tail -f /tmp/server.log

# Or check the terminal where npm run dev is running
```

Look for any errors or warnings when you try to access the page.

## Current Server Status

✅ Server is running on port 5000  
✅ Health check endpoint works  
✅ CORS headers configured  
✅ Server responds to curl requests  

## Next Steps

1. **Identify your environment** - Are you using Replit, Cursor, local machine, etc.?
2. **Find the correct URL** - Don't use localhost if you're in a remote environment
3. **Check environment documentation** - Look for port forwarding or public URL configuration
4. **Test API endpoints** - If API works but frontend doesn't, it's a routing issue

## Quick Test

Run this to verify server is accessible:
```bash
curl -v http://localhost:5000/api/health
```

If this works but browser doesn't, the issue is with browser access, not the server.
