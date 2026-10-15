
const session = require("express-session");
const bcrypt = require("bcryptjs");

function setupStaffSecurity(app) {
  const passwordHash = process.env.STAFF_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!passwordHash || !sessionSecret) {
    throw new Error(
      "Staff password hash or session secret is missing"
    );
  }

  app.use(
    session({
      name: "mediqueue.staff",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        maxAge: 60 * 60 * 1000
      }
    })
  );

  function checkLocalOrigin(req, res, next) {
    const origin = req.get("origin");

    if (origin) {
      try {
        const url = new URL(origin);

        const allowedHost = [
          "localhost",
          "127.0.0.1"
        ].includes(url.hostname);

        const allowedPort = [
          "5000",
          "5173",
          "5174",
          "5175",
          "5176",
          "5177"
        ].includes(url.port);

        if (!allowedHost || !allowedPort) {
          return res.status(403).json({
            message: "Request origin not allowed"
          });
        }
      } catch {
        return res.status(403).json({
          message: "Invalid request origin"
        });
      }
    }

    next();
  }

  function requireStaff(req, res, next) {
    if (req.session?.staffAuthenticated === true) {
      return next();
    }

    return res.status(401).json({
      message: "Staff login required"
    });
  }

  app.get("/api/staff/session", (req, res) => {
    res.json({
      authenticated:
        req.session?.staffAuthenticated === true
    });
  });

  app.post(
    "/api/staff/login",
    checkLocalOrigin,
    async (req, res) => {
      try {
        const password = req.body?.password;

        if (
          typeof password !== "string" ||
          !password ||
          password.length > 200
        ) {
          return res.status(400).json({
            message: "Valid password required"
          });
        }

        const matched = await bcrypt.compare(
          password,
          passwordHash
        );

        if (!matched) {
          return res.status(401).json({
            message: "Incorrect staff password"
          });
        }

        req.session.regenerate(error => {
          if (error) {
            return res.status(500).json({
              message: "Unable to create session"
            });
          }

          req.session.staffAuthenticated = true;

          req.session.save(saveError => {
            if (saveError) {
              return res.status(500).json({
                message: "Unable to save session"
              });
            }

            res.json({
              message: "Staff login successful",
              authenticated: true
            });
          });
        });
      } catch (error) {
        console.error("Staff login error:", error.message);

        res.status(500).json({
          message: "Unable to log in"
        });
      }
    }
  );

  app.post(
    "/api/staff/logout",
    checkLocalOrigin,
    requireStaff,
    (req, res) => {
      req.session.destroy(error => {
        if (error) {
          return res.status(500).json({
            message: "Unable to log out"
          });
        }

        res.clearCookie("mediqueue.staff");

        res.json({
          message: "Logged out successfully"
        });
      });
    }
  );

  // Protect doctor administration endpoints.
  app.use(
    "/api/doctors/:id/availability",
    checkLocalOrigin,
    requireStaff
  );

  app.use(
    "/api/doctors/:id/schedule",
    checkLocalOrigin,
    requireStaff
  );
}

module.exports = setupStaffSecurity;
