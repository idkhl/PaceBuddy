import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import axios from "axios";
import Database from "better-sqlite3";
import path from "path";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), "pacebuddy.db");
const db = new Database(dbPath);

// Create plans table
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    title TEXT NOT NULL,
    plan_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// if (process.env.NODE_ENV !== "production") {
//   dotenv.config();
// }

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // In-memory store for tokens
  const tokenStore = new Map<
    string,
    { access_token: string; refresh_token: string; expires_at: number; athlete_id: string }
  >();

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get user plans
  app.get("/api/plans", (req, res) => {
    const sessionId = req.cookies.session_id;
    const session = sessionId ? tokenStore.get(sessionId) : null;
    
    if (!session || !session.athlete_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const stmt = db.prepare("SELECT * FROM plans WHERE athlete_id = ? ORDER BY created_at DESC");
      const plans = stmt.all(session.athlete_id);
      res.json(plans);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  // Save a plan
  app.post("/api/plans", (req, res) => {
    const sessionId = req.cookies.session_id;
    const session = sessionId ? tokenStore.get(sessionId) : null;
    
    if (!session || !session.athlete_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, plan_text } = req.body;
    if (!title || !plan_text) {
      return res.status(400).json({ error: "Missing title or plan_text" });
    }

    try {
      const stmt = db.prepare("INSERT INTO plans (athlete_id, title, plan_text) VALUES (?, ?, ?)");
      const info = stmt.run(session.athlete_id, title, plan_text);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save plan" });
    }
  });

  // 1. Get Strava Auth URL
  app.get("/api/auth/url", (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "STRAVA_CLIENT_ID not configured" });
    }

    // Use APP_URL if available, otherwise fallback to localhost for local dev
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read,activity:read_all,profile:read_all",
    });

    const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  // 2. Handle Strava Callback
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return res.send(`
        <html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            }
          </script>
          <p>Authentication failed: ${error}</p>
        </body></html>
      `);
    }

    if (!code || typeof code !== "string") {
      return res.status(400).send("Missing authorization code");
    }

    try {
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Strava credentials not configured");
      }

      const tokenResponse = await axios.post(
        "https://www.strava.com/oauth/token",
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
        },
      );

      const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;

      // Generate a simple session ID
      const sessionId = Math.random().toString(36).substring(2, 15);

      // Store tokens
      tokenStore.set(sessionId, { access_token, refresh_token, expires_at, athlete_id: athlete?.id?.toString() });

      // Set cookie
      res.cookie("session_id", sessionId, {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.send(`
        <html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body></html>
      `);
    } catch (err: any) {
      console.error(
        "Error exchanging token:",
        err.response?.data || err.message,
      );
      res.status(500).send("Failed to exchange authorization code");
    }
  });

  // 3. Check Auth Status
  app.get("/api/auth/status", (req, res) => {
    const sessionId = req.cookies.session_id;
    if (sessionId && tokenStore.has(sessionId)) {
      res.json({ authenticated: true });
    } else {
      res.json({ authenticated: false });
    }
  });

  // 4. Logout
  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.cookies.session_id;
    if (sessionId) {
      tokenStore.delete(sessionId);
    }
    res.clearCookie("session_id", {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    res.json({ success: true });
  });

  // 5. Fetch Strava Activities
  app.get("/api/strava/activities", async (req, res) => {
    const sessionId = req.cookies.session_id;
    if (!sessionId || !tokenStore.has(sessionId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let tokens = tokenStore.get(sessionId)!;

    // Check if token is expired (add a small buffer)
    if (Date.now() / 1000 > tokens.expires_at - 60) {
      try {
        const refreshResponse = await axios.post(
          "https://www.strava.com/oauth/token",
          {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: tokens.refresh_token,
          },
        );

        tokens = {
          access_token: refreshResponse.data.access_token,
          refresh_token: refreshResponse.data.refresh_token,
          expires_at: refreshResponse.data.expires_at,
          athlete_id: tokens.athlete_id,
        };
        tokenStore.set(sessionId, tokens);
      } catch (err) {
        console.error("Error refreshing token:", err);
        return res.status(401).json({ error: "Failed to refresh token" });
      }
    }

    try {
      // Fetch athlete zones
      let zones = null;
      try {
        const zonesResponse = await axios.get(
          "https://www.strava.com/api/v3/athlete/zones",
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );
        zones = zonesResponse.data;
      } catch (e) {
        console.error("Failed to fetch zones", e);
      }

      // Fetch last 30 activities
      const activitiesResponse = await axios.get(
        "https://www.strava.com/api/v3/athlete/activities?per_page=30",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      // Filter for running activities
      const runs = activitiesResponse.data.filter((activity: any) => activity.type === "Run");

      // Fetch detailed data for the 5 most recent runs to get best efforts and GAP
      const detailedRuns = await Promise.all(
        runs.slice(0, 5).map(async (run: any) => {
          try {
            const detailResponse = await axios.get(
              `https://www.strava.com/api/v3/activities/${run.id}`,
              {
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                },
              }
            );
            return detailResponse.data;
          } catch (e) {
            console.error(`Failed to fetch details for activity ${run.id}`, e);
            return run; // fallback to summary
          }
        })
      );

      // Combine detailed runs with the rest of the summary runs
      const allRuns = [
        ...detailedRuns,
        ...runs.slice(5)
      ].map((run: any) => ({
        id: run.id,
        name: run.name,
        distance: run.distance, // in meters
        moving_time: run.moving_time, // in seconds
        start_date: run.start_date,
        average_speed: run.average_speed, // meters per second
        total_elevation_gain: run.total_elevation_gain,
        average_heartrate: run.average_heartrate,
        max_heartrate: run.max_heartrate,
        average_grade_adjusted_pace: run.average_grade_adjusted_pace, // meters per second
        best_efforts: run.best_efforts ? run.best_efforts.map((be: any) => ({
          name: be.name,
          moving_time: be.moving_time,
          distance: be.distance
        })) : undefined,
      }));

      res.json({ activities: allRuns, zones });
    } catch (err: any) {
      console.error(
        "Error fetching activities:",
        err.response?.data || err.message,
      );
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
